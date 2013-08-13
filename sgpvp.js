// SGPvP object and a few functions. This code must run in Firefox and
// Google Chrome - no Greasemonkey calls and no chrome.extension stuff
// here.  localStorage should not be accessed from here either.

// V21

function SGPvP() {
    this.url = window.location.href;

    var m = /^https?:\/\/([^.]+)\.pardus\.at\/([^.]+)\.php/.exec(this.url);
    if(!m)
        return;

    this.universe = m[1];
    this.page = m[2];

    if(this.page == 'ship2ship_combat') {
        selectHighestRounds();
        selectMissiles();
    }
    else if(this.page == 'building') {
        selectMissiles();
    }

    // We wanted addEventListener, but need to use document.onkeydown,
    // because that's what pardus uses and we need to trap the cursor
    // keys while the info dialogue is open.

    var self = this;

    this.game_kbd_handler = document.onkeydown;
    document.onkeydown = function(event) { self.keyPressHandler(event); };

    //window.addEventListener('keypress',
    //                        function(event) { self.keyPressHandler(event); },
    //                        false);
}

// CONFIGURABLE BITS, IF YOU KNOW WHAT YOU'RE DOING:

// XXX this will be smarter soon, bots needs an overhaul anyway
SGPvP.prototype.DEFAULT_BOTS = 5;

// the number is the keyCode, usually ASCII
SGPvP.prototype.ACTIONS = {
    /* Z */ 90: 'storeRP',
    /* X */ 88: 'engage',
    /* C */ 67: 'disengage',
    /* V */ 86: 'nav',
    /* B */ 66: 'bots',
    /* M */ 77: 'damageBuilding',
    /* A */ 65: 'bots2',
    /* S */ 83: 'bots5',
    /* D */ 68: 'bots8',
    /* F */ 70: 'fillUp',
    /* K */ 75: 'cloak',
    /* T */ 84: 'highlightTargets',
    /* I */ 73: 'ui',
    /* ESC */ 27: 'closeUi',

    /* 1 */ 49: 'target',
    /* 2 */ 50: 'engage',
    /* 3 */ 51: 'nav',
    /* 4 */ 52: 'jumpToRetreatTile',
    /* 5 */ 53: 'bots'
};

// ship priorities - all else being the same, first listed here are first shot
SGPvP.prototype.SHIPS = [
    // 1 - real traders and low level hybrids
    'leviathan', 'boa_ultimate_carrier', 'behemoth', 'extender', 'celeus',
    'lanner', 'blood_lanner', 'mantis', 'elpadre', 'constrictor', 'hercules',
    'babel_transporter', 'junkeriv', 'lanner_mini', 'slider', 'harrier',

    // 2 - possible traders relatively easy to kill
    'mooncrusher', 'war_nova',

    // 3 - fighters
    'dominator', 'liberator', 'liberator_eps', 'sudden_death', 'gauntlet',
    'scorpion', 'pantagruel', 'chitin', 'horpor', 'gargantua', 'reaper',
    'vulcan', 'piranha', 'venom', 'rover', 'mercury', 'trident', 'marauder',
    'shadow_stealth_craft',

    // 4 - breakers
    'phantom_advanced_stealth_craft', 'hawk', 'doomstar',
    'viper_defence_craft', 'nano', 'nighthawk_deluxe', 'nighthawk',

    // 5 - harmless noob ships that may still be under protection
    'thunderbird', 'spectre', 'interceptor', 'adder', 'tyrant', 'rustfire',
    'wasp', 'ficon', 'rustclaw', 'sabre'
];

// END CONFIGURABLE BITS, no user serviceable parts below

SGPvP.prototype.keyPressHandler = function(event) {
    if(window.name == '' || event.ctrlKey || event.altKey || event.metaKey) {
        if(this.game_kbd_handler)
            this.game_kbd_handler(event);
        return;
    }

    if(event.target &&
       (event.target.nodeName == 'INPUT' || event.target.nodeName == 'TEXTAREA')) {
        // nop, and don't call the game's handler cause it may move the ship
        return;
    }

    var method_name = this.ACTIONS[event.keyCode];
    if(method_name) {
        var method = this[method_name];
        if(method) {
            event.preventDefault();
            event.stopPropagation();
            method.call(this);
        }
    }
    else if(this.game_kbd_handler) {
        this.game_kbd_handler(event);
    }
};

SGPvP.prototype.showNotification = function(text, delay) {
    if(this.notification_timer)
        clearTimeout(this.notification_timer);
    this.hideNotification();
    this.notification = this.createElement('div',
                                       { position: 'fixed', zIndex: '15', padding: '0.5em', textAlign: 'center',
                                         fontSize: '18px', verticalAlign: 'middle',
                                         top: '50%', left: '50%', width: '8em', height: 'auto',
                                         marginLeft: '-4em', marginTop: '-2.2em',
                                         border: 'ridge 2px #556', backgroundColor: 'rgb(0,0,28)' },
                                       null, text, null);
    document.body.appendChild(this.notification);

    var self = this;
    this.notification_timer = setTimeout(function() {
                                             self.notification_timer = null;
                                             self.hideNotification();
                                         }, delay);
};

SGPvP.prototype.hideNotification = function() {
    if(this.notification)
        document.body.removeChild(this.notification);
    this.notification = null;
};

SGPvP.prototype.createElement = function(tag, style, attributes, text_content, parent) {
    var e = document.createElement(tag);
    if(attributes)
        for(property in attributes)
            e[property] = attributes[property];
    if(style)
        for(property in style)
            e.style[property] = style[property];
    if(text_content)
        e.appendChild(document.createTextNode(text_content));
    if(parent)
        parent.appendChild(e);
    return e;
};

SGPvP.prototype.closeUi = function() {
    if(this.ui_element) {
        this.ui_element.parentNode.removeChild(this.ui_element);
        this.ui_element = null;
    }
};

SGPvP.prototype.ui = function() {
    if(this.ui_element)
        return;

    var create_element = this.createElement;

    var table, tr, td, e1, e2;
    var ql_ta, inc_ta, exc_ta, rid_field, close_but;

    table = create_element('table',
                           { position: 'fixed', zIndex: '10', borderCollapse: 'collapse',
                             top: '3em', left: '50%', width: '50em', height: 'auto', marginLeft: '-25em',
                             border: 'ridge 2px #556', backgroundColor: 'rgb(0,0,28)' },
                           null, null, null);

    tr = create_element('tr', null, null, null, table);
    td = create_element('td', { padding: '1em' }, { colSpan: 2 }, null, tr);
    create_element('h3', { margin: 0, textAlign: 'center' }, null, "Scorpion Guard's Better PvP Script", td);

    tr = create_element('tr', null, null, null, table);
    td = create_element('td', { padding: '0 1em' }, { colSpan: 2 }, null, tr);
    create_element('label', null, { htmlFor: 'sgpvp-ql' }, "Inclusions and exclusions (quick list format):", td);
    tr = create_element('tr', null, null, null, table);
    td = create_element('td', { padding: '0 1em' }, { colSpan: 2 }, null, tr);
    ql_ta = create_element('textarea', { width: '100%' }, { id: 'sgpvp-ql', rows: 5 }, null, td);

    tr = create_element('tr', null, null, null, table);
    create_element('td', { padding: '1em 1em 0 1em' }, { colSpan: 2 },
                   "Overrides (names or IDs, one per line, includes are prioritised)", tr);

    tr = create_element('tr', { verticalAlign: 'top' }, null, null, table);
    td = create_element('td', { padding: '0 0.5em 0 1em', width: '50%' }, null, null, tr);
    e1 = create_element('div', null, null, null, td);
    create_element('label', null, { htmlFor: 'sgpvp-inc' }, "include:", e1);
    e1 = create_element('div', null, null, null, td);
    inc_ta = create_element('textarea', { width: '100%' }, { id: 'sgpvp-inc', rows: 6 }, null, e1);
    td = create_element('td', { padding: '0 1em 0 0.5em', width: '50%' }, null, null, tr);
    e1 = create_element('div', null, null, null, td);
    create_element('label', null, { htmlFor: 'sgpvp-exc' }, "exclude:", e1);
    e1 = create_element('div', null, null, null, td);
    exc_ta = create_element('textarea', { width: '100%' }, { id: 'sgpvp-exc', rows: 6 }, null, e1);

    tr = create_element('tr', null, null, null, table);
    td = create_element('td', { padding: '1em 1em 0 1em' }, { colSpan: 2 }, null, tr);
    create_element('label', null, { htmlFor: 'sgpvp-rid' }, "Retreat tile ID: ", td);
    rid_field = create_element('input', { textAlign: 'right' }, { id: 'sgpvp-rid', type: 'text', size: 5 }, null, td);

    tr = create_element('tr', null, null, null, table);
    td = create_element('td', { padding: '2em 1em 1em 1em', textAlign: 'center' }, { colSpan: 2 }, null, tr);
    close_but = create_element('input', null, { type: 'button', value: 'Close' }, null, td);

    document.body.appendChild(table);

    // handlers
    var self = this;

    var enable_button = function(enabled) {
        if(enabled) {
            close_but.disabled = false;
            close_but.style.borderColor = 'inherit';
            close_but.style.color = 'inherit';
        }
        else {
            close_but.disabled = true;
            close_but.style.borderColor = 'rgb(0,0,28)';
            close_but.style.color = 'rgb(56,56,84)';
        }
    };

    var timer;
    var save_handler = function() {
        if(self.saveTargetingData(ql_ta.value, inc_ta.value, exc_ta.value,
                                  rid_field.value))
            enable_button(true);
        timer = null;
    };
    var change_handler = function() {
        enable_button(false);
        if(timer)
            clearTimeout(timer);
        timer = setTimeout(save_handler, 500);
    };
    var close_handler = function() { self.closeUi(); };

    // load settings and install handlers
    this.loadSettings(['textQL', 'targetingData', 'retreatTile'],
                      function(results) {
                          ql_ta.value = results[0];
                          var targetingData = results[1];
                          inc_ta.value = self.stringifyOverrideList(targetingData.include);
                          exc_ta.value = self.stringifyOverrideList(targetingData.exclude);
                          rid_field.value = results[2];

                          ql_ta.addEventListener('keyup', change_handler, false);
                          inc_ta.addEventListener('keyup', change_handler, false);
                          exc_ta.addEventListener('keyup', change_handler, false);
                          rid_field.addEventListener('keyup', change_handler, false);
                          close_but.addEventListener('click', close_handler, false);
                      });
    
    this.ui_element = table;
};

SGPvP.prototype.saveTargetingData = function(ql,
                                             include_overrides, exclude_overrides,
                                             retreat_tile) {
    var ok;
    var qo = this.parseQL(ql);
    if(qo) {
        var o = {
            ql: qo.parsed,
            include: this.parseOverrideList(include_overrides),
            exclude: this.parseOverrideList(exclude_overrides)
        };

        this.storeSettings({ targetingData: {ql: qo.ql, data: o}, retreatTile: retreat_tile });
        ok = true;
    }

    return ok;
};

SGPvP.prototype.parseQL = function(ql) {
    var o;

    ql = ql.replace(/\s+/g, '');
    if(ql.length > 0) {
        var a = ql.split(';');
        if(a.length == 22) {
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

SGPvP.prototype.parseOverrideList = function(list) {
    var a = list.split('\n');
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

SGPvP.prototype.stringifyOverrideList = function(list_object) {
    var a = new Array();
    for(var id in list_object.ids)
        a[list_object.ids[id] - 1] = id;
    for(var name in list_object.names)
        a[list_object.names[name] - 1] = name;
    return a.join('\n');
};

SGPvP.prototype.target = function() {
    var url = this.url;
    var page;
    var ships;

    if(this.page == 'building') {
        page = 'b';
        ships = getShipsBuilding();
    }
    else if(this.page == 'ship2ship_combat') {
        page = 'c';
        ships = getShipsCombat();
    }
    else {
        page = 'n';
        ships = getShipsNav();
    }

    if(ships) {
        var self = this;
        this.loadSettings(['targetingData'],
                          function(results) {
                              var targeting_data = results[0];
                              var targets = self.scanForTargets(targeting_data, ships);

                              if(targets.included.length > 0) {
                                  var ship_pri = (page == 'n') ? self.getShipModelPriorities() : null;
                                  var best = self.chooseTarget(targets.included, ship_pri);
                                  document.location = 'ship2ship_combat.php?playerid=' + best.id;
                                  return;
                              }

                              self.nav();
                          });
    }
};

SGPvP.prototype.highlightTargets = function() {
    var url = this.url;
    var page;
    var ships;

    if(this.page == 'building') {
        page = 'b';
        ships = getShipsBuilding();
    }
    else if(this.page == 'ship2ship_combat') {
        page = 'c';
        ships = getShipsCombat();
    }
    else {
        page = 'n';
        ships = getShipsNav();
    }

    var highlight_target = function(td, colour) {
        td.style.backgroundColor = colour;
        td.previousSibling.style.backgroundColor = colour;
    };

    if(ships) {
        for(var i = 0, end = ships.length; i < end; i++)
            highlight_target(ships[i].td, 'inherit');

        var self = this;
        this.loadSettings(['targetingData'],
                          function(results) {
                              var targeting_data = results[0];
                              var targets = self.scanForTargets(targeting_data, ships);

                              // turn the excluded ships green
                              for(var i = 0, end = targets.excluded.length; i < end; i++)
                                  highlight_target(targets.excluded[i].td, '#050');

                              if(targets.included.length > 0) {
                                  // turn the included ships red
                                  for(var i = 0, end = targets.included.length; i < end; i++)
                                      highlight_target(targets.included[i].td, '#500');

                                  // highlight the chosen target
                                  var ship_pri = (page == 'n') ? self.getShipModelPriorities() : null;
                                  var best = self.chooseTarget(targets.included, ship_pri);
                                  highlight_target(best.td, '#900');
                              }
                          });
    }
};

SGPvP.prototype.scanForTargets = function(targeting_data, ships) {
    var exc = new Array();
    var inc = new Array();
    var ql = targeting_data.ql;
    var include = targeting_data.include;
    var exclude = targeting_data.exclude;

    for(var i = 0, end = ships.length; i < end; i++) {
        var ship = ships[i];
        var name = ship.name.toLowerCase();
        var n;

        if(exclude.ids[ship.id] || exclude.names[name]) {
            exc.push(ship);
        }
        else if((n = include.ids[ship.id]) || (n = include.names[name])) {
            ship.includePriority = n;
            inc.push(ship);
        }
        else if(ql.excludeFactions[ship.faction] ||
           ql.excludeAlliances[ship.ally_id] ||
           ql.excludeCharacters[ship.id])
            exc.push(ship);
        else if(ql.includeFactions[ship.faction] ||
                ql.includeAlliances[ship.ally_id] ||
                ql.includeCharacters[ship.id])
            inc.push(ship);
    }

    return {
        excluded: exc,
        included: inc
    };
};

SGPvP.prototype.chooseTarget = function(ships, ship_pri) {
    var best;

    for(var i = 0, end = ships.length; i < end; i++) {
        var ship = ships[i];
        if(!best)
            best = ship;
        else {
            if(best.includePriority) {
                if(ship.includePriority &&
                   (ship.includePriority < best.includePriority))
                    best = ship;
            }
            else {
                if(ship.includePriority)
                    best = ship;
                else {
                    if(ship_pri) {
                        var sm = ship_pri[ship.shipModel];
                        var bm = ship_pri[best.shipModel];

                        if(sm < bm)
                            best = ship;
                        else if(sm == bm) {
                            if(ship.id < best.id)
                                best = ship;
                        }
                    }
                    else {
                        if(ship.id < best.id)
                            best = ship;
                    }
                }
            }
        }
    }

    return best;
};

SGPvP.prototype.getShipModelPriorities = function() {
    var a = this.SHIPS;
    var o = new Object();

    for(var i = 0, end = a.length; i < end; i++)
        o[a[i]] = i + 1;

    return o;
};

SGPvP.prototype.storeRP = function() {
    var userloc = this.getLocation();
    if(userloc) {
        this.storeSettings({ retreatTile: userloc });
        this.showNotification('Retreat tile set: ' + userloc, 500);
    }
    else
        this.showNotification('Can not set retreat tile', 500);
};

SGPvP.prototype.engage = function() {
    if(this.page == 'ship2ship_combat')
        this.clickButton('Attack');
    else
        this.target();
};

SGPvP.prototype.disengage = function() {
    if(this.page == 'ship2ship_combat')
        this.nav();
    else
        this.jumpToRetreatTile();
};

SGPvP.prototype.nav = function() { document.location = 'main.php'; };

SGPvP.prototype.damageBuilding = function() {
    if(this.page == 'building')
        this.clickButton('destroy');
    else
        document.location = 'building.php';
};

SGPvP.prototype.jumpToRetreatTile = function() {
    if(this.page == 'building')
        this.clickButton('Retreat');
    else {
        var self = this;
        this.loadSettings(['retreatTile'],
                          function(results) {
                              var tile_id = results[0];
                              if(tile_id) {
                                  document.getElementById('navForm').elements[0].value = tile_id;
                                  document.getElementById('navForm').submit();
                              }
                              else {
                                  // XXX
                                  self.showNotification('NO RETREAT TILE SET', 500);
                                  self.nav();
                              }
                          });
    }
};

SGPvP.prototype.bots = function() { this.useBots(this.DEFAULT_BOTS); }; // XXX compute amount needed
SGPvP.prototype.bots2 = function() { this.useBots(2); };
SGPvP.prototype.bots5 = function() { this.useBots(5); };
SGPvP.prototype.bots8 = function() { this.useBots(8); };
SGPvP.prototype.fillUp = function() { document.location = 'main.php?fillup=1'; };
//SGPvP.prototype.enterBuilding = function() { document.location = 'building.php'; };

SGPvP.prototype.useBots = function(amount) {
    document.location = 'main.php?amount=' + amount + '&resid=8&useres=Use';
};

SGPvP.prototype.cloak = function() {
    this.clickButton('cloak');
};

SGPvP.prototype.parseFactionSpec = function(spec) {
    var r;
    var m = /^\s*(f?)(e?)(u?)(n?)\s*$/.exec(spec);
    if(m) {
        r = new Object();
        r['fed'] = m[1] ? true : false;
        r['emp'] = m[2] ? true : false;
        r['uni'] = m[3] ? true : false;
        r['neu'] = m[4] ? true : false;
    }

    return r;
};

SGPvP.prototype.parseIDList = function(idlist) {
    var r = new Object(), a = idlist.split(','), n;
    for(var i = 0, end = a.length; i < end; i++) {
        n = parseInt(a[i]);
        if(n > 0)
            r[n] = i+1;
    }
    return r;
};

// Adapted from 12345:

SGPvP.prototype.clickButton = function(label) {
    var input = document.getElementById(label);

    if(!input)
        // Try by name
        input = document.getElementsByName(label)[0];

    if(!input) {
        // Try by value
        var inputs = document.getElementsByTagName('input');
        for(var i = 0, end = inputs.length; i < end; i++) {
            var element = inputs[i];
            if(element.value == label && element.type == 'submit') {
                input = element;
                break;
            }
        }
    }

    if(!input) {
        // Try button tags
        var inputs = document.getElementsByTagName('button');
        for(var i = 0, end = inputs.length; i < end; i++) {
            var element = inputs[i];
            if(element.innerHTML == label) {
                input = element;
                break;
            }
        }
    }

    if(input && input.click)
        input.click();
    else
        this.nav();
};

// Code adapted from Sweetener:

function getShipsNav() {
    var ships;
    var sbox = document.getElementById('otherships_content');
    if(sbox) {
        // console.log(sbox);
        var rx =
            /^javascript:scanId\((\d+),(?:\s|%20)*['"]player['"]\)|main\.php\?scan_details=(\d+)&scan_type=player$/;
        ships = getShips(sbox,
                         "table/tbody/tr/td[position() = 2]/a",
                         function(url) {
                             var r;
                             var m = rx.exec(url);
                             if(m) {
                                 if(!(r = m[1]))
                                     r = m[2];
                                 r = { id: parseInt(r) };
                             }
                             return r;
                         });
    }
    return ships;
}

function getShipsBuilding() {
    var ships;
    var rx = /building\.php\?detail_type=player&detail_id=(\d+)$/;
    ships = getShips(document,
                     "//table/tbody[tr/th = 'Other Ships']/tr/td/a",
                     function(url) {
                         var r;
                         var m = rx.exec(url);
                         if(m)
                             r = { id: parseInt(m[1]) };
                         return r;
                     });

    return ships;
}

/// W should add to the list the ship we are engaging, but we can't
function getShipsCombat() {
    var ships;
             
    var rx = /ship2ship_combat\.php\?playerid=(\d+)/;
    ships = getShips(document,
                     "//table/tbody[tr/th = 'Other Ships']/tr/td/a",
                     function(url) {
                         var r;
                         var m = rx.exec(url);
                         if(m)
                             r = { id: parseInt(m[1]) };
                         return r;
                     });

    return ships;
}

// This one extracts a list of ships/opponents from a container
// element. xpath is evaluated from container, and is expected to find
// the links that matchId will match.
function getShips(container, xpath, matchId) {
    var doc = container.ownerDocument;
    if(!doc)
        doc = container;
    var ships = [];
    var xpr = doc.evaluate(xpath, container, null,
                           XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    var a, entry;
    while((a = xpr.iterateNext())) {
        var href = a.href;
        var m = matchId(href);
        if(m) {
            var td = a.parentNode;
            entry = m;
            entry.name = a.textContent;
            entry.td = td;
            ships.push(entry);

            // see if we find an alliance link
            var xpr2 = doc.evaluate("font/b/a", td, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                                    null);
            var aa;
            while((aa = xpr2.iterateNext())) {
                if(aa.pathname == '/alliance.php' && (m = /^\?id=(\d+)$/.exec(aa.search))) {
                    entry.ally_id = parseInt(m[1]);
                    entry.ally_name = aa.textContent;
                    break;
                }
            }

            // find the ship type
            var itd = td.previousSibling;
            if((m = /([^/]+)\.png/.exec(itd.style.backgroundImage)))
                entry.shipModel = m[1];

            // see if we find a faction
            xpr2 = doc.evaluate("img", itd, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE,
                                null);
            while((aa = xpr2.iterateNext())) {
                if((m = /factions\/sign_(fed|emp|uni)/.exec(aa.src))) {
                    entry.faction = m[1];
                    break;
                }
            }

            if(!entry.faction)
                entry.faction = 'neu';
        }
    }

    return ships;
}

function selectMissiles() {
    var inputs = document.getElementsByTagName('input');
    for(var i = 0, end = inputs.length; i < end; i++) {
        var input = inputs[i];
        if(input.type == 'checkbox' && /^\d+_missile$/.test(input.id))
            input.checked = true;
    }
}

function selectHighestRounds() {
    var elts = document.getElementsByName('rounds');

    var selectHighestRoundsInSelectElement = function(elt) {
        var highest = 0, highestElt = null;
        var opts = elt.getElementsByTagName('option');
        for(var j = 0; j < opts.length; j++) {
            var opt = opts[j];
            var n = parseInt(opt.value);
            if(n > highest) {
                highest = n;
                highestElt = opt;
            }
        }
        if(highestElt)
            highestElt.selected = true;
    };

    for(var i = 0; i < elts.length; i++) {
        var elt = elts[i];
        if(elt.style.display == 'none') {
            // for some reason, Pardus now hides the rounds select,
            // and instead adds a second, visible select element, with
            // a gibberish name.
            elt = elt.nextElementSibling;
            if(elt && elt.tagName == 'SELECT')
                selectHighestRoundsInSelectElement(elt);
        }
        else
            selectHighestRoundsInSelectElement(elt);
    }
}
