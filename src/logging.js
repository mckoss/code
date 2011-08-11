var clientLib = require('com.pageforest.client');
var types = require('org.startpad.types');
require('org.startpad.string').patch();

var LOG_DOC = '_logs';

var username;
var storage;
var scope;

exports.extend({
    'init': init,
    'log': log,
    'getUsers': getUsers,
    'getUserLog': getUserLog
});

function init(_username, _storage, _scope) {
    username = _username;
    storage = _storage;
    scope = _scope;
}

function log(eventName, data) {
    if (!storage) {
        return;
    }
    var logAs = username || 'anonymous';
    var obj = types.extend(data, {event: eventName, scope: scope, time: new Date().toString()});
    console.log("Logging: " + JSON.stringify(obj));
    storage.push(LOG_DOC, logAs, obj);
}

function getUsers(callback) {
    var users = [];
    storage.list(LOG_DOC, undefined, undefined, function (json) {
        for (var prop in json.items) {
            users.push(prop);
        }
        callback(users);
    });
}

function getUserLog(username, callback) {
    storage.getBlob(LOG_DOC, username, undefined, function (data) {
        callback(username, data);
    });
}