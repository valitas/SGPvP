// This runs on the menu and message frames. If those get focus, they receive
// keyboard events. We forward those as messages to the main frame.

let mainFrame;

document.addEventListener('keydown', onKeyDown);

function findMainFrame() {
    let frames = window.top.frames;
    for (let i = frames.length - 1; i >= 0; i--) {
        let frame = frames[i];
        if (frame.frameElement.id === 'main') {
            return frame;
        }
    }
    return null;
}

function onKeyDown(event) {
    if (mainFrame === undefined) {
        mainFrame = findMainFrame();
    }

    if (mainFrame === null || event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    if (event.target) {
        var name = event.target.nodeName;
        if (name === 'INPUT' || name === 'SELECT' || name === 'TEXTAREA') {
            return;
        }
    }

    let msg = { sgpvp: 'keydown', keyCode: event.keyCode };
    mainFrame.postMessage(msg, document.location.origin);
}
