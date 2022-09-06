(function () {
  "use strict";

  let code;

  const MESSAGE_TYPE = {
    SDP: "SDP",
    CANDIDATE: "CANDIDATE",
  };

  document.addEventListener("input", async (event) => {
    if (event.target.id === "code-input") {
      const { value } = event.target;
      if (value.length > 8) {
        document.getElementById("start-button").disabled = false;
        code = value;
      } else {
        document.getElementById("start-button").disabled = true;
        code = null;
      }
    }
  });

  document.addEventListener("click", async (event) => {
    if (event.target.id === "start-button" && code) {
      startChat();
    }
  });

  const startChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      showChatRoom();

      const signaling = new WebSocket("ws://127.0.0.1:1337");
      const peerConnection = createPeerConnection(signaling);

      addMessageHandler(signaling, peerConnection);

      stream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));
      document.getElementById("self-view").srcObject = stream;
    } catch (err) {
      console.error(err);
    }
  };

  const createPeerConnection = (signaling) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.test.com:193000" }],
    });

    peerConnection.onnegotiationneeded = async () => {
      await createAndSendOffer();
    };

    peerConnection.onicecandidate = (iceEvent) => {
      if (iceEvent && iceEvent.candidate) {
        sendMessage(signaling, {
          message_type: MESSAGE_TYPE.CANDIDATE,
          content: iceEvent.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const video = document.getElementById("remote-view");
      if (!video.srcObject) {
        video.srcObject = event.streams[0];
      }
    };

    return peerConnection;
  };

  const addMessageHandler = (signaling, peerConnection) => {
    signaling.onmessage = async (message) => {
      const data = JSON.parse(message.data);

      if (!data) {
        return;
      }

      const { message_type, content } = data;
      try {
        if (message_type === MESSAGE_TYPE.CANDIDATE && content) {
          await peerConnection.addIceCandidate(content);
        } else if (message_type === MESSAGE_TYPE.SDP) {
          if (content.type === "offer") {
            await peerConnection.setRemoteDescription(content);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            sendMessage(signaling, {
              message_type: MESSAGE_TYPE.SDP,
              content: answer,
            });
          } else if (content.type === "answer") {
            await peerConnection.setRemoteDescription(content);
          } else {
            console.log("Unsupported SDP type.");
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
  };

  const sendMessage = (signaling, message) => {
    if (code) {
      signaling.send(
        JSON.stringify({
          ...message,
          code,
        })
      );
    }
  };

  const createAndSendOffer = async (signaling, peerConnection) => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendMessage(signaling, {
      message_type: MESSAGE_TYPE.SDP,
      content: offer,
    });
  };

  const showChatRoom = () => {
    document.getElementById("start").style.display = "none";
    document.getElementById("chat-room").style.display = "block";
  };
})();
