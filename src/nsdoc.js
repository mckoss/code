/*jslint evil:true */
var types = require('org.startpad.types');
var base = require('org.startpad.base');
var format = require('org.startpad.format');
var string = require('org.startpad.string').patch();
var ut = require('com.jquery.qunit');

exports.extend({
    'namespaceDoc': namespaceDoc,
    'updateScriptSections': updateScriptSections,
    'updateChallenges': updateChallenges
});

var testInfo;

types.extend(namespace.com.jquery.qunit.QUnit, {
    testStart: function (info) {
        testInfo = info;
    },

    log: function (info) {
        if (!info.result) {
            if (!info.message) {
                info.message = "Expected: " + info.expected + ", Actual: " + info.actual;
            }
        }
        var $results = $('#test_' + testInfo.name);
        $results.append('<div class="test {0}">{0}: {1}<div>'.format(info.result ? "PASS" : "FAIL",
                                                                     info.message));
    }
});

var reArgs = /^function\s+\S*\(([^\)]*)\)/;
var reFuncName = /function\s+(\S+)\s*\(/;
var reComma = /\s*,\s/;

function functionDoc(name, func) {
    var s = new base.StBuf();
    var level = name.split('.').length;

    s.append(format.repeat('#', level) + ' *' + name + '*(');

    var args = reArgs.exec(func.toString());
    if (args === null) {
        return "error reading function: " + name + '\n';
    }
    args = args[1].split(reComma);
    var sep = '';
    if (args.length > 1 || args[0] != '') {
        s.append('*' + args.join('*, *') + '*');
        sep = ', ';
    }
    if (func.toString().indexOf('arguments') != -1) {
        s.append(sep + '...');
    }
    s.append(')\n');

    name = name[0].toLowerCase() + name.slice(1);
    for (var methodName in func.prototype) {
        if (typeof func.prototype[methodName] == 'function') {
            var method = func.prototype[methodName];
            s.append(functionDoc(name + '.' + methodName, method));
        }
    }

    return s.toString();
}

function getFunctionName(func) {
    if (typeof func != 'function') {
        return "notAFunction";
    }
    var result = reFuncName.exec(func.toString());
    if (result == null) {
        return "anonymous";
    }
    return result[1];
}

function namespaceDoc(ns) {
    var s = new base.StBuf();

    for (var name in ns) {
        if (ns.hasOwnProperty(name)) {
            var func = ns[name];
            if (typeof func != 'function' || name == '_closure') {
                continue;
            }

            s.append(functionDoc(name, func));
        }
    }
    return s.toString();
}

/*
   Update embedded <script> sections and insert markdown-formatted
   blocks to display them.

   <script class="eval-lines"> can be used to eval each line and
   append a comment with the returned value.

   REVIEW: Injecting script into DOM executes on Firefox?  Need to disable.
*/
function updateScriptSections(context) {
    var scripts = $('script', context);
    var e;
    var printed;

    function write() {
        var args = Array.prototype.slice.call(arguments, 1);
        var s = string.format(arguments[0], args);
        while (s.length > 80) {
            printed.push(s.slice(0, 80));
            s = s.slice(80);
        }
        printed.push(s);
    }

    for (var i = 0; i < scripts.length; i++) {
        var script = scripts[i];
        printed = [];
        var body = base.strip(script.innerHTML);
        var lines = body.split('\n');
        var comments = [];
        var max = 0;
        var jBegin = 0;
        for (var j = 0; j < lines.length; j++) {
            if (j != lines.length - 1 &&
                !/^\S.*;\s*$/.test(lines[j])) {
                comments[j] = '';
                continue;
            }
            var batch = lines.slice(jBegin, j + 1).join('\n');
            batch = base.strip(batch);
            try {
                var value = eval(batch);
                if (value == undefined) {
                    comments[j] = '';
                } else {
                    if (typeof value == 'string') {
                        value = '"' + value + '"';
                        value.replace(/"/g, '""');
                    }
                    if (typeof value == 'function') {
                        value = "function " + getFunctionName(value);
                    }
                    if (typeof value == 'object') {
                        if (value === null) {
                            value = "null";
                        } else {
                            var prefix = getFunctionName(value.constructor) + ': ';
                            try {
                                value = prefix + JSON.stringify(value);
                            } catch (e3) {
                                value += prefix + "{...}";
                            }
                        }
                    }
                    comments[j] = '// ' + value.toString();
                }
            } catch (e2) {
                comments[j] = "// Exception: " + e2.message;
            }
            max = Math.max(lines[j].length, max);
            jBegin = j + 1;
        }

        for (j = 0; j < lines.length; j++) {
            if (comments[j] != "") {
                lines[j] += format.repeat(' ', max - lines[j].length + 2) + comments[j];
            }
        }
        body = lines.join('\n');
        $(script).before('<pre><code>' + format.escapeHTML(body) + '</code></pre>');
        if (printed.length > 0) {
            $(script).after('<pre class="printed"><code>' +
                            format.escapeHTML(printed.join('\n')) +
                            '</code></pre>');
        }
    }
}

function updateChallenges(context) {
    var challenges = $('challenge', context);
    var printed;

    for (var i = 0; i < challenges.length; i++) {
        var challenge = challenges[i];
        var prefix = $('prefix', challenge).text();
        var code = $('code', challenge).text();
        var testCode = $('test', challenge).text();
        var suffix = $('prefix', challenge).text();
        $(challenge).html('<textarea>' + format.escapeHTML(code) + '</textarea>');
        $(challenge).after('<div class="test-results" id="test_{0}"></div>'.format(i));

        var nsChallenge = makeNamespace(code,
                                        prefix,
                                        suffix);
        namespace.challenge = nsChallenge;
        var nsTest = makeNamespace(testCode,
                                   "var ut = require('com.jquery.qunit');" +
                                   "var challenge = require('challenge');" +
                                   "exports.testFunction = function testFunction() {",
                                   "}");
        nsTest.challenge = nsChallenge;
        try {
            ut.test(i, nsTest.testFunction);
        } catch (e) {
        }
    }
}

function makeNamespace(code, prefix, suffix) {
    prefix = prefix || '';
    suffix = suffix || '';

    var ns = {};
    var closure = new Function('exports', 'require', prefix + code + suffix);
    closure(ns, require);
    return ns;
}
