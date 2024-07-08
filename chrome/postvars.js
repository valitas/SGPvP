(function () {
    let navved = false;
    function onmsg(event) {
        console.log('received message on main', event.origin, event.data);
        let data = event.data;
        if (data.sgpvp !== 3) {
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
    window.addEventListener('message', onmsg);

    let f = function () {
        let msg = {
            sgpvp: 1,
            loc: typeof (userloc) === 'undefined' ? null : userloc,
            ajax: typeof (ajax) === 'undefined' ? null : ajax
        };
        window.postMessage(
            msg,
            `${window.location.protocol}//${window.location.host}`
        );
    };
    if (typeof (addUserFunction) == 'function') {
        addUserFunction(f);
    }
    f();
})();
