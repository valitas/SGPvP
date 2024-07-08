(function () {
    let navved = false;
    function onMessage(event) {
        let data = event.data;
        if (data.sgpvp !== 'click-id') {
            return;
        }

        let elt = document.getElementById(data.id);
        if (elt && elt.click &&
            !(elt.disabled || elt.classList.contains('disabled'))) {
            elt.click();
        } else if (!navved) {
            document.location = 'main.php';
            navved = true;
        }
    }
    window.addEventListener('message', onMessage);

    let postVars = function () {
        let msg = {
            sgpvp: 'pardus-vars',
            loc: typeof userloc === 'undefined' ? null : userloc,
            ajax: typeof ajax === 'undefined' ? null : ajax
        };
        window.postMessage(msg, document.location.origin);
    };
    if (typeof (addUserFunction) == 'function') {
        addUserFunction(postVars);
    }
    postVars();
})();
