// -*- js3-indent-level: 4; js3-indent-tabs-mode: nil -*-


// SGPvPUI and related objects - user interface implementation.
//
// This code must run on Firefox and Google Chrome - no Greasemonkey calls and
// no chrome.* APIs here.  localStorage should not be accessed from here either.


// XXX - The way we handle actions with arguments is a bit awkward now.  We
// probably should be done with the hidden fields, and instead add and remove
// action-specific HTML, but event handlers on the dynamic controls are a
// problem...

function SGPvPAction() { }
SGPvPAction.prototype.serialise = function() { return this.id; };
SGPvPAction.prototype.displayName = function() { return this.name; };
// Mind: this one is to be called in the context of the SGPvPUI element.
SGPvPAction.prototype.updateSetKeyPanelArgs = function() {
    var e = this.elements;
    e.skarg_bots.style.display = 'none';
    e.skarg_rounds.style.display = 'none';
    e.skarg_missiles.style.display = 'none';
    e.skarg_alwaysmax.style.display = 'none';
};

function SGPvPNoAction() { }
SGPvPNoAction.prototype.serialise = function() { return ''; };
SGPvPNoAction.prototype.displayName = function() { return ''; };
SGPvPNoAction.prototype.updateSetKeyPanelArgs =
    SGPvPAction.prototype.updateSetKeyPanelArgs;

// Actions with just a "missiles" setting (e.g. damage building)
function SGPvPActionM() { }
SGPvPActionM.prototype.serialise = function(missiles) {
    return this.id + (missiles != 'n' ? ',m' : ',n');
};
SGPvPActionM.prototype.displayName = function(missiles) {
    return this.name + (missiles != 'n' ? '' : ' no missiles');
};
// Call these two from SGPvPUI context
SGPvPActionM.prototype.updateSetKeyPanelArgs = function(missiles) {
    var e = this.elements;
    e.skarg_bots.style.display = 'none';
    e.skarg_rounds.style.display = 'none';
    e.skarg_alwaysmax.style.display = 'none';
    e.skarg_missiles.style.display = null; // default to block
    e.setkey_missiles.checked = (missiles != 'n');
};
SGPvPActionM.prototype.getArgsFromUI = function() {
    var e = this.elements;
    return [ e.setkey_missiles.checked ? 'm' : 'n' ];
};

// Actions with "rounds" and "missiles" settings (e.g. engage)
function SGPvPActionRM() { }
SGPvPActionRM.prototype.serialise = function(rounds, missiles) {
    return this.id + ',' + (rounds || 20) +
        (missiles != 'n' ? ',m' : ',n');
};
SGPvPActionRM.prototype.displayName = function(rounds, missiles) {
    if(!rounds)
        rounds = 20;
    return this.name + (rounds == 20 ? '' : ' '+rounds) +
        (missiles != 'n' ? '' : ' no missiles');
};
// Call these two from SGPvPUI context
SGPvPActionRM.prototype.updateSetKeyPanelArgs = function(rounds, missiles) {
    var e = this.elements;
    e.skarg_bots.style.display = 'none';
    e.skarg_alwaysmax.style.display = 'none';
    e.skarg_rounds.style.display = null; // default to block
    e.setkey_rounds.style.color = null; // default
    e.setkey_rounds.value = (rounds || 20);
    e.skarg_missiles.style.display = null; // default to block
    e.setkey_missiles.checked = (missiles != 'n');

};
SGPvPActionRM.prototype.getArgsFromUI = function() {
    var e = this.elements,
    rounds = this.getPositiveIntegerValue(e.setkey_rounds, 20);
    if(rounds)
        return [ rounds, e.setkey_missiles.checked ? 'm' : 'n' ];
    return null;
};

// Action with a "number of bots" setting. Currently just force use robots.
function SGPvPActionB() { }
SGPvPActionB.prototype.serialise = function(bots) {
    return this.id + ',' + (bots || 1);
};
SGPvPActionB.prototype.displayName = function(bots) {
    if(!bots)
        bots = 1;
    return 'Force use ' + (bots == 1 ? '1 robot' : bots + ' robots');
};
// Call these two from SGPvPUI context
SGPvPActionB.prototype.updateSetKeyPanelArgs = function(bots) {
    var e = this.elements;
    e.skarg_rounds.style.display = 'none';
    e.skarg_missiles.style.display = 'none';
    e.skarg_alwaysmax.style.display = 'none';
    e.skarg_bots.style.display = null; // default to block
    e.setkey_bots.style.color = null; // default
    e.setkey_bots.value = (bots || 1);
};
SGPvPActionB.prototype.getArgsFromUI = function() {
    var e = this.elements,
    bots = this.getPositiveIntegerValue(e.setkey_bots);
    if(bots)
        return [ bots ];
    return null;
};

// Actions with "armour threshold", "rounds", and "missiles" settings (win,
// winRaid)
function SGPvPActionWin() { }
SGPvPActionWin.prototype.serialise = function( threshold, rounds, missiles ) {
    return this.id + ',' +
        (threshold == 'm' ? 'm' : 'l') + ',' +
        (rounds || 20) + ',' +
        (missiles != 'n' ? 'm' : 'n');
};
SGPvPActionWin.prototype.displayName = function(threshold, rounds, missiles) {
    if(!rounds)
        rounds = 20;
    return this.name + (rounds == 20 ? '' : ' '+rounds) +
        (missiles != 'n' ? '' : ' no mis') +
        (threshold == 'm' ? ' max arm' : '')
};
SGPvPActionWin.prototype.updateSetKeyPanelArgs =
    function(threshold, rounds, missiles) {
    var e = this.elements;
    e.skarg_bots.style.display = 'none';
    e.skarg_alwaysmax.style.display = null; // default to block
    e.setkey_alwaysmax.checked = (threshold == 'm');
    e.skarg_rounds.style.display = null; // default to block
    e.setkey_rounds.value = (rounds || 20);
    e.skarg_missiles.style.display = null; // default to block
    e.setkey_missiles.checked = (missiles != 'n');
};
SGPvPActionWin.prototype.getArgsFromUI = function() {
    var e = this.elements,
        rounds = this.getPositiveIntegerValue(e.setkey_rounds, 20);
    if ( rounds )
        return [ e.setkey_alwaysmax.checked ? 'm' : 'l',
                 rounds,
                 e.setkey_missiles.checked ? 'm' : 'n' ];
    return null;
};

// Actions with "armour threshold" and "missiles" settings (winB, winBRaid)
function SGPvPActionWinB() { }
SGPvPActionWinB.prototype.serialise = function( threshold, missiles ) {
    return this.id + ',' +
        (threshold == 'm' ? 'm' : 'l') + ',' +
        (missiles != 'n' ? 'm' : 'n');
};
SGPvPActionWinB.prototype.displayName = function(threshold, missiles) {
  return this.name +
        (missiles != 'n' ? '' : ' no mis') +
        (threshold == 'm' ? ' max arm' : '');
};
SGPvPActionWinB.prototype.updateSetKeyPanelArgs =
    function(threshold, missiles) {
    var e = this.elements;
    e.skarg_bots.style.display = 'none';
    e.skarg_rounds.style.display = 'none';
    e.skarg_alwaysmax.style.display = null; // default to block
    e.setkey_alwaysmax.checked = (threshold == 'm');
    e.skarg_missiles.style.display = null; // default to block
    e.setkey_missiles.checked = (missiles != 'n');
};
SGPvPActionWinB.prototype.getArgsFromUI = function() {
    var e = this.elements;
    return [ e.setkey_alwaysmax.checked ? 'm' : 'l',
             e.setkey_missiles.checked ? 'm' : 'n' ];
};

// Actions with just a "repair if not low armour" setting (currently just bots)
function SGPvPActionA() { }
SGPvPActionA.prototype.serialise = function(threshold) {
    return this.id + (threshold == 'l' ? ',l' : ',m');
};
SGPvPActionA.prototype.displayName = function(threshold) {
    var name;
    if ( this.name == 'Use bots' )
        name = 'Bots';
    else
        name = this.name;
    if ( threshold == 'l' )
        name += ' if low armour';
    return name;
};
// Call these two from SGPvPUI context
SGPvPActionA.prototype.updateSetKeyPanelArgs = function(threshold) {
    var e = this.elements;
    e.skarg_bots.style.display = 'none';
    e.skarg_rounds.style.display = 'none';
    e.skarg_missiles.style.display = 'none';
    e.skarg_alwaysmax.style.display = 'null'; // default to block
    e.setkey_alwaysmax.checked = (threshold != 'l');
};
SGPvPActionA.prototype.getArgsFromUI = function() {
    var e = this.elements;
    return [ e.setkey_alwaysmax.checked ? 'm' : 'l' ];
};


// Actions not listed here are regular SGPvPAction types.
SGPvPUI.prototype.ACTION_TYPES = {
  '': SGPvPNoAction,
  bots: SGPvPActionA,
  damageBuilding: SGPvPActionM,
  raidBuilding: SGPvPActionM,
  engage: SGPvPActionRM,
  raid: SGPvPActionRM,
  forceBots: SGPvPActionB,
  win: SGPvPActionWin,
  winRaid: SGPvPActionWin,
  winB: SGPvPActionWinB,
  winBRaid: SGPvPActionWinB
};


function SGPvPUI(sgpvp, storage, doc) {
    this.sgpvp = sgpvp;
    this.storage = storage;
    this.doc = doc;
}

SGPvPUI.prototype.injectStyle = function() {
    var doc = this.doc;

    if(doc.getElementById('sg-style'))
        return;

    var head = doc.evaluate('/html/head', doc, null,
                                 XPathResult.ANY_UNORDERED_NODE_TYPE,
                                 null).singleNodeValue;
    var link = doc.createElement('link');
    link.id = 'sg-style';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = this.sgpvp.getResourceURL('ui_style');
    head.appendChild(link);
};

// We use all these elements from the UI DOM.
SGPvPUI.prototype.UI_ELEMENT_IDS =
    [ 'sg-close',
      'sg-default-keymap',
      'sg-exc',
      'sg-impexp-keymap',
      'sg-inc',
      'sg-keybindings',
      'sg-keyboard',
      'sg-low',
      'sg-lvl',
      'sg-max',
      'sg-ql',
      'sg-rid',
      'sg-s2keys',
      'sg-s2targeting',
      'sg-setkey',
      'sg-setkey-alwaysmax',
      'sg-setkey-bots',
      'sg-setkey-code',
      'sg-setkey-done',
      'sg-setkey-key',
      'sg-setkey-missiles',
      'sg-setkey-rounds',
      'sg-setkey-select',
      'sg-skarg-alwaysmax',
      'sg-skarg-bots',
      'sg-skarg-missiles',
      'sg-skarg-rounds',
      'sg-targeting',
      'sg-version' ];

SGPvPUI.prototype.open = function() {
    if(this.ui_element)
        return;

    this.sgpvp.getResourceText('ui_html', finish.bind(this));

    function finish( uihtml ) {
        var doc = this.doc,
	    parser = new DOMParser(),
            e = {},
            dummy, div, i, id;

        this.injectStyle();

	dummy = parser.parseFromString( uihtml, 'text/html' );
	div = dummy.body.removeChild( dummy.body.firstElementChild );

        doc.body.appendChild(div);

        this.ui_element = div;
        this.elements = e;

        // Centre it
        div.style.left = ((doc.body.clientWidth - 600) / 2) + 'px';

        // Get the elements we use for controlling the UI
        for( i in this.UI_ELEMENT_IDS ) {
            id = this.UI_ELEMENT_IDS[ i ];
            e[id.substr(3).replace('-','_')] = doc.getElementById(id);
        }

        e.version.textContent = this.sgpvp.getVersion();

        // load settings and configure
        this.storage.get( [ 'keymap', 'ql', 'targeting', 'rtid', 'armour' ],
                          this.configure.bind(this) );
    }
};

// This is called once we know sgpvp has loaded its parameters.
SGPvPUI.prototype.configure = function() {
    var storage = this.storage,
        e = this.elements,
        targeting, armour;

    this.keymap = storage.keymap;
    e.ql.value = storage.ql;
    targeting = storage.targeting;
    e.inc.value = this.stringifyOverrideList(targeting.include);
    e.exc.value = this.stringifyOverrideList(targeting.exclude);
    e.rid.value = storage.rtid;
    armour = storage.armour;
    e.low.value = armour.low;
    e.max.value = armour.max;
    e.lvl.value = armour.level;

    this.targetingValid = true;
    this.rtidValid = true;

    // Armour is the one setting that is invalid on the very first config.  So
    // watch for this.
    this.armourValid =
        ( armour.low > 0 && armour.max > 0 && armour.low <= armour.max );

    this.enableCloseIfProper();

    this.initActionCatalogue();

    // Make handlers
    var onS2TargetingClick = this.switchToPanel.bind(this, 'targeting'),
    onS2KeysClick = this.switchToPanel.bind(this, 'bindings'),
    onTargetingInput = this.onTargetingInput.bind(this),
    onArmInput = this.onArmInput.bind(this),
    onRtIdInput = this.onRtIdInput.bind(this),
    onCloseClick = this.close.bind(this),
    onKeyClick = this.onKeyClick.bind(this),
    onSetKeySelectChange = this.onSetKeySelectChange.bind(this),
    onSetKeyArgInput = this.onSetKeyArgInput.bind(this),
    onDefaultKeymapClick = this.resetKeyMap.bind(this, 'default_keymap'),
    onImpExpKeymapClick = this.importKeyMap.bind(this);

    // Install handlers
    e.s2targeting.addEventListener('click', onS2TargetingClick, false);
    e.s2keys.addEventListener('click', onS2KeysClick, false);
    e.ql.addEventListener('input', onTargetingInput, false);
    e.inc.addEventListener('input', onTargetingInput, false);
    e.exc.addEventListener('input', onTargetingInput, false);
    e.rid.addEventListener('input', onRtIdInput, false);
    e.low.addEventListener('input', onArmInput, false);
    e.max.addEventListener('input', onArmInput, false);
    e.lvl.addEventListener('input', onArmInput, false);
    e.close.addEventListener('click', onCloseClick, false);
    e.setkey_done.addEventListener('click', onS2KeysClick, false);
    e.setkey_select.addEventListener('change', onSetKeySelectChange, false);
    e.setkey_bots.addEventListener('input', onSetKeyArgInput, false);
    e.setkey_rounds.addEventListener('input', onSetKeyArgInput, false);
    e.setkey_alwaysmax.addEventListener('click', onSetKeyArgInput, false);
    e.setkey_missiles.addEventListener('click', onSetKeyArgInput, false);
    e.default_keymap.addEventListener('click', onDefaultKeymapClick, false);
    e.impexp_keymap.addEventListener('click', onImpExpKeymapClick, false);

    this.labelAllKeys();

    // Bind the keys
    var kdiv,
    xpr = this.doc.evaluate('div', e.keyboard, null,
                            XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    while((kdiv = xpr.iterateNext()))
        kdiv.addEventListener('click', onKeyClick, false);

};

SGPvPUI.prototype.toggle = function() {
    if(this.ui_element)
        this.close();
    else
        this.open();
};

SGPvPUI.prototype.close = function() {
    if(this.ui_element) {
        this.ui_element.parentNode.removeChild(this.ui_element);
        delete this.ui_element;
    }
};

SGPvPUI.prototype.enableClose = function(enabled) {
    var close = this.elements.close;
    if(enabled) {
        close.disabled = false;
        close.style.borderColor = null;
        close.style.color = null;
    }
    else {
        close.disabled = true;
        close.style.borderColor = 'rgb(0,0,28)';
        close.style.color = 'rgb(56,56,84)';
    }
};

SGPvPUI.prototype.enableCloseIfProper = function() {
    var enabled = this.targetingValid && this.armourValid && this.rtidValid;
    this.enableClose(enabled);
};

// Parse QL and include/exclude lists. Store if they are valid,
// inhibit close if they are not.
SGPvPUI.prototype.onTargetingInput = function() {
    var qo, settings;

    this.targetingValid = false;

    qo = this.parseQL(this.elements.ql.value);
    if(qo) {
        this.targetingValid = true;
        this.elements.ql.style.removeProperty('color');
        settings = {
            ql: qo.ql,
            targeting: {
                ql: qo.parsed,
                include: this.parseOverrideList(this.elements.inc.value),
                exclude: this.parseOverrideList(this.elements.exc.value)
            }
        };
        this.storage.set( settings );
    }
    else
        this.elements.ql.style.color = 'red';
    this.enableCloseIfProper();
};

SGPvPUI.prototype.DIGITS_RX = /^\s*[0-9]+\s*$/;
SGPvPUI.prototype.EMPTY_RX = /^\s*$/;

// Gets the value of the given element. If it's a positive integer,
// return it. If it isn't, turn the element red and return null. If
// max is supplied, then value also must be <= max.  If allowEmpty is
// true, then an empty string will return -1 and the element
// won't turn red.
SGPvPUI.prototype.getPositiveIntegerValue = function(element, max, allowEmpty) {
    var value = element.value;
    if(this.DIGITS_RX.test(value)) {
        var nvalue = parseInt(value);
        if(nvalue > 0 && (!max || nvalue <= max)) {
            element.style.color = null;
            return nvalue;
        }
    }
    else if(allowEmpty && this.EMPTY_RX.test(value)) {
        element.style.color = null;
        return -1;
    }

    // Still here? Problem.
    element.style.color = 'red';
    return null;
};

SGPvPUI.prototype.onArmInput = function() {
    var low = this.getPositiveIntegerValue(this.elements.low),
        max = this.getPositiveIntegerValue(this.elements.max),
        level = this.getPositiveIntegerValue(this.elements.lvl, 7);
    if ( low && max && low <= max && level > 0 ) {
        this.armourValid = true;
        this.storage.set( { armour: { low: low, max: max, level: level } } );
    }
    else
        this.armourValid = false;
    this.enableCloseIfProper();
};

SGPvPUI.prototype.onRtIdInput = function() {
    var rtid = this.getPositiveIntegerValue(this.elements.rid, null, true);
    if(rtid) {
        this.rtidValid = true;
        if(rtid > 0)
            this.storage.set( { rtid: rtid } );
        // else XXX - we should have a deleteSettings method...
    }
    else
        this.rtidValid = false;
    this.enableCloseIfProper();
};

SGPvPUI.prototype.switchToPanel = function(panel) {
    var e = this.elements;
    switch(panel) {
    case 'targeting':
        e.s2targeting.className = 'active';
        e.s2keys.className = '';
        e.targeting.style.display = 'block';
        e.keybindings.style.display = 'none';
        e.setkey.style.display = 'none';
        this.enableCloseIfProper();
        break;
    case 'bindings':
        e.s2targeting.className = '';
        e.s2keys.className = 'active';
        e.targeting.style.display = 'none';
        e.keybindings.style.display = 'block';
        e.setkey.style.display = 'none';
        this.enableClose(true);
    }
};

// Build our catalogue of available actions. We fetch most of this
// from HTML, cause it's already there so we may as well use it.
// However, there are a few actions with parameters; those we
// deal with exceptionally here.

SGPvPUI.prototype.initActionCatalogue = function() {
    this.catalogue = new Object();

    var option, doc = this.doc, e = this.elements,
    xpr = doc.evaluate('.//option', e.setkey_select, null,
                       XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    while((option = xpr.iterateNext())) {
        var id = option.value,
        type = this.ACTION_TYPES[id] || SGPvPAction,
        action = new type();
        action.id = id;
        action.name = option.textContent;
        this.catalogue[id] = action;
    }
};

SGPvPUI.prototype.parseAction = function(action_str) {
    var args, id;

    if(action_str) {
        args = action_str.split(',');
        id = args.shift();
    }
    else {
        args = [ ];
        action_str = id = '';
    }

    var action = this.catalogue[id];

    // XXX - this should never happen, remove.
    if(!action) {
        action = new SGPvPAction();
        action.id = id;
        action.name = action_str;
        console.log('parsed unknown action', action);
    }

    return { action: action, args: args };
};

SGPvPUI.prototype.onKeyClick = function(event) {
    var keydiv = event.currentTarget;
    this.setkey_div = keydiv;
    this.setkey_code = parseInt(keydiv.id.substr(4));

    var e = this.elements,
    cap = keydiv.firstChild.textContent, // bit flaky but succinct
    a = this.parseAction(this.keymap[this.setkey_code]);

    e.keybindings.style.display = 'none';
    e.setkey.style.display = 'block';
    e.setkey_code.textContent = this.setkey_code;
    e.setkey_key.textContent = cap;
    this.setKeyLegend(e.setkey_key,
                      a.action.displayName.apply(a.action, a.args));
    a.action.updateSetKeyPanelArgs.apply(this, a.args);
    this.enableClose(false);

    for(var options = e.setkey_select.options, i = 0, end = options.length;
        i < end; i++) {
        if(options.item(i).value == a.action.id) {
            e.setkey_select.selectedIndex = i;
            break;
        }
    }
};

SGPvPUI.prototype.onSetKeyArgInput = function() {
    var e = this.elements,
    opts = e.setkey_select.options,
    action_id = opts[e.setkey_select.selectedIndex].value,
    action = this.catalogue[action_id],
    args = action.getArgsFromUI.apply(this);

    if(!args)
        // bad input
        return;

    var legend = action.displayName.apply(action, args),
    action_str = action.serialise.apply(action, args);

    this.setKeyLegend(e.setkey_key, legend);
    this.setKeyLegend(this.setkey_div, legend);
    this.keymap[this.setkey_code] = action_str;
    this.storeKeyMap();
};

SGPvPUI.prototype.onSetKeySelectChange = function() {
    var e = this.elements,
    opts = e.setkey_select.options,
    a = this.parseAction(opts[e.setkey_select.selectedIndex].value),
    legend = a.action.displayName.apply(a.action, a.args),
    action_str = a.action.serialise.apply(a.action, a.args);

    this.setKeyLegend(e.setkey_key, legend);
    this.setKeyLegend(this.setkey_div, legend);
    a.action.updateSetKeyPanelArgs.apply(this, a.args);

    if(action_str)
        this.keymap[this.setkey_code] = action_str;
    else
        delete this.keymap[this.setkey_code];

    this.storeKeyMap();
};

SGPvPUI.prototype.setKeyLegend = function(key, legend) {
    if(legend) {
        var legenddiv = key.firstElementChild;
        if(!legenddiv) {
            legenddiv = key.ownerDocument.createElement('div');
            key.appendChild(legenddiv);
        }
        legenddiv.textContent = legend;
    }
    else {
        var legenddiv = key.firstElementChild;
        if(legenddiv)
            key.removeChild(legenddiv);
    }
};

SGPvPUI.prototype.labelAllKeys = function() {
    var doc = this.doc, e = this.elements,
        xpr = doc.evaluate('div', e.keyboard, null,
                           XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
    for(var i = 0, end = xpr.snapshotLength; i < end; i++) {
        var kdiv = xpr.snapshotItem(i),
        code = parseInt(kdiv.id.substr(4)),
        a = this.parseAction(this.keymap[code]),
        legend = a.action.displayName.apply(a.action, a.args);
        this.setKeyLegend(kdiv, legend);
    }
};

SGPvPUI.prototype.resetKeyMap = function(resid) {
    var r = confirm('This will remove all custom key bindings you '
                    + 'may have defined. You OK with this?');
    if(r)
        this.sgpvp.getResourceText(resid, setKeys.bind(this));

    function setKeys( keymap ) {
        this.keymap = JSON.parse(keymap);
        this.storeKeyMap();
        this.labelAllKeys();
    }
};

SGPvPUI.prototype.importKeyMap = function() {
    var text = JSON.stringify(this.keymap), k,
    r = prompt('Copy this text to export the keymap. ' +
               'Edit or replace it, and press OK, to import the keymap.',
               text);
    if(r) {
        try {
            k = JSON.parse(r);
        } catch (x) {
            k = null;
        }

        if(k && typeof(k) == 'object') {
            this.storage.fixKeymap( k );
            this.keymap = k;
            this.storeKeyMap();
            this.labelAllKeys();
        }
        else {
            alert('The keymap has errors and could not be imported.');
        }
    }
};

SGPvPUI.prototype.storeKeyMap = function() {
    this.storage.set( { keymap: this.keymap } );
};

SGPvPUI.prototype.parseOverrideList = function(list) {
    var a = list.split(/\n|,/);
    var ids = new Object();
    var names = new Object();
    for(var i = 0, end = a.length; i < end; i++) {
        var s = a[i].replace(/^\s+|\s+$/g, '');
        if(s.length > 0) {
            if(/^[0-9]+$/.test(s))
                ids[parseInt(s)] = i+1;
            else
                names[s.toLowerCase()] = i+1;
        }
    }

    return { ids: ids, names: names };
};

SGPvPUI.prototype.parseQL = function(ql) {
    var o;

    ql = ql.replace(/\s+/g, '');
    if(ql.length > 0) {
        var a = ql.split(';');
        if(a.length == 22 || a.length == 23) {
            var inf = this.parseFactionSpec(a[5]);
            if(inf) {
                var ef = this.parseFactionSpec(a[16]);
                if(ef) {
                    o = {
                        ql: ql,
                        parsed: {
                            includeFactions: inf,
                            excludeFactions: ef,
                            includeAlliances: this.parseIDList(a[13]),
                            excludeAlliances: this.parseIDList(a[19]),
                            includeCharacters: this.parseIDList(a[14]),
                            excludeCharacters: this.parseIDList(a[20])
                        }
                    };
                }
            }
        }
    }
    else {
        var no = new Object();
        o = {
            ql: '',
            parsed: {
                includeFactions: no,
                excludeFactions: no,
                includeAlliances: no,
                excludeAlliances: no,
                includeCharacters: no,
                excludeCharacters: no
            }
        };
    }

    return o;
};

SGPvPUI.prototype.FACTIONSPEC_RX = /^\s*(f?)(e?)(u?)(n?)\s*$/;
SGPvPUI.prototype.parseFactionSpec = function(spec) {
    var r;
    var m = this.FACTIONSPEC_RX.exec(spec);
    if(m) {
        r = new Object();
        r['fed'] = m[1] ? true : false;
        r['emp'] = m[2] ? true : false;
        r['uni'] = m[3] ? true : false;
        r['neu'] = m[4] ? true : false;
    }

    return r;
};

SGPvPUI.prototype.parseIDList = function(idlist) {
    var r = new Object(), a = idlist.split(','), n;
    for(var i = 0, end = a.length; i < end; i++) {
        n = parseInt(a[i]);
        if(n > 0)
            r[n] = i+1;
    }
    return r;
};

SGPvPUI.prototype.stringifyOverrideList = function(list_object) {
    var a = new Array();
    for(var id in list_object.ids)
        a[list_object.ids[id] - 1] = id;
    for(var name in list_object.names)
        a[list_object.names[name] - 1] = name;
    return a.join('\n');
};
