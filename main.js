//import general css file and install&import firebase.
import './style.css';

import firebase from 'firebase/app';
import 'firebase/firestore';

//this is our firestore database config create your firestore database then copy/paste your config here.
const firebaseConfig = {
  apiKey: "AIzaSyAD2F6e_8ID7DA-ea1anWOZ1Q1Otvywsok",
  authDomain: "webrtcproject-25b8f.firebaseapp.com",
  databaseURL: "https://webrtcproject-25b8f-default-rtdb.firebaseio.com",
  projectId: "webrtcproject-25b8f",
  storageBucket: "webrtcproject-25b8f.appspot.com",
  messagingSenderId: "349621738725",
  appId: "1:349621738725:web:5d3018df92cddfbeae880c"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

//these are google real time chat and talk servers. we use them for RTCPeerConnection.
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

//RTCPeerConnection creates connection between remote and local device.
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// these elements are using around of the project.
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

//navigator object is using for getting browser information.
//we get user media as video=true & audio =true. then we create localStream video object and this is our video.
//we get all tracks and push tracks to peer connection from local.
//we create remoteStream object as null MediaStream object.
//then we pull tracks from remote stream, add to video stream
webcamButton.onclick = async () => {
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(localStream => {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
    webcamVideo.srcObject = localStream;
  });
  
  remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// this function create call.
// we create a reference to firestore collections for signaling.

callButton.onclick = async () => {
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callInput.value = callDoc.id;

// we get the caller information and save it into firestore database.
  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  // create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await callDoc.set({ offer });

  // listen for remote answer
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // when answered, add candidate to peer connection
  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};

hangupButton.onclick = async () => {
  pc.close();
  remoteVideo.srcObject = null;
  location.reload();
}