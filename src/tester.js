/*jslint evil:true */
var types = require('org.startpad.types');
var ut = require('com.jquery.qunit');

var testInfo;

types.extend(ut.QUnit, {
    testStart: function (info) {
        testInfo = info;
    },

    log: function (info) {
        if (!info.message) {
            info.message = "Expected: " + info.expected + ", Actual: " + info.actual;
        }
        postMessage({challenge: testInfo.name, info: info});
    }
});

function onMessage(event) {
    // { challenge: number, code: string, test: string }
    var data = event.data;
    var nsCode = {},
        nsTest = {};

    try {
        var closure = new Function('exports', 'require', data.code);
        closure(nsCode, require);
        var testClosure = new Function('exports', 'require', 'challenge',
                                       "var ut = require('com.jquery.qunit');" +
                                       "exports.testFunction = function testFunction() {" +
                                       data.test +
                                       "};");
        testClosure(nsTest, require, nsCode);
        ut.QUnit.init();
        ut.test(data.challenge, nsTest.testFunction);
        ut.QUnit.start();
    } catch (e) {
        postMessage({challenge: data.challenge,
                     info: {result: false, message: e.toString()}
                    });
    }
}

self.onmessage = onMessage;
