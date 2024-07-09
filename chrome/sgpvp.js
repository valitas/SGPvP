let sgmain = new SGMain(document);

document.addEventListener('keydown', onKeyDown);

function onKeyDown(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    if (event.target) {
        var name = event.target.nodeName;
        if (name === 'INPUT' || name === 'SELECT' || name === 'TEXTAREA')
            return;
    }

    if (sgmain.keyPressHandler(event.keyCode)) {
        event.preventDefault();
        event.stopPropagation();
    }
}
