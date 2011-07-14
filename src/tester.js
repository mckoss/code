/*jslint evil:true */
var types = require('org.startpad.types');
var ut = require('com.jquery.qunit');
require('org.startpad.string').patch();

var testInfo;

types.extend(ut.QUnit, {
    testStart: function (info) {
        testInfo = info;
        postMessage({challenge: info.name, type: 'start', info: info});
    },

    testDone: function (info) {
        postMessage({challenge: info.name, type: 'done', info: info});
    },

    log: function (info) {
        if (!info.message) {
            info.message = "Expected: " + info.expected + ", Actual: " + info.actual;
        }
        postMessage({challenge: testInfo.name, type: 'test', info: info});
    }
});

function onMessage(event) {
    // { challenge: number, code: string, test: string }
    var data = event.data;
    var nsCode = {},
        nsTest = {};

    function writeFunction(s) {
        postMessage({challenge: data.challenge, type: 'write', message: s.toString()});
    }

    try {
        var closure = new Function('exports', 'require', 'write', data.code);
        closure(nsCode, require, writeFunction);
        var testClosure = new Function('exports', 'require', 'challenge', 'write',
                                       "var ut = require('com.jquery.qunit');" +
                                       "exports.testFunction = function testFunction() {" +
                                       data.test +
                                       "};");
        testClosure(nsTest, require, nsCode, writeFunction);
        ut.QUnit.init();
        ut.test(data.challenge, nsTest.testFunction);
        ut.QUnit.start();
    } catch (e) {
        postMessage({challenge: data.challenge,
                     type: 'error',
                     info: {result: false, message: e.toString()}
                    });
    }
}

self.onmessage = onMessage;
