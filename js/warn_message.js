const warn_messages = [
  ["%cDo not paste any text in here","background: red; color: yellow; font-size: x-large"],
  ["Pasting anything in here may give others access to your account.",""]
]
function warnmessage() {
  for (let message of warn_messages) {
    console.log(message[0],message[1]);
  }
}
setInterval(warnmessage,3000)
