function createModal(text,renderAsHTML=false) {
    if(!document.getElementById("modal")) {
        const shade = document.createElement("div")
        shade.id = "modal-shade"
        const m = document.createElement("div")
        m.id = "modal"
        const close = document.createElement("button")
        close.id = "modal-close-button"
        close.innerText = "Close"
        close.onclick = function() {
            m.style.display = shade.style.display = 'none';
        }
        const textdiv = document.createElement("div")
        textdiv.id = "modal-text-div"
        m.appendChild(textdiv)
        m.appendChild(close)
        document.body.insertBefore(m,document.body.children[0])
        document.body.insertBefore(shade,document.body.children[0])
    }
    const currentModal = document.getElementById("modal")
    const shade = document.getElementById("modal-shade")
    if(renderAsHTML) {
        document.getElementById("modal-text-div").innerHTML = text
    } else {
        document.getElementById("modal-text-div").innerText = text
    }
    currentModal.style.display = shade.style.display = "block"
}


// This code is a workaround for IE6's lack of support for the
// position: fixed style.
//
if (!('maxHeight' in document.body.style)) {
    function modalsize() {
      var top = document.documentElement.scrollTop;
      var winsize = document.documentElement.offsetHeight;
      var docsize = document.documentElement.scrollHeight;
      shade.style.height = Math.max(winsize, docsize) + 'px';
      modal.style.top = top + Math.floor(winsize / 3) + 'px';
    };
    modal.style.position = shade.style.position = 'absolute';
    window.onscroll = window.onresize = modalsize;
    modalsize();
  }