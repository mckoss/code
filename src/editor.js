var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var nsdoc = require('org.startpad.nsdoc');
var markdown = new Showdown.converter();

exports.extend({
    'onEditorReady': onEditorReady,
    'onLessonReady': onLessonReady
});

var client;
var doc;                            // Bound elements here
var blob;
var lastText = "";
var syncTime = 5;
var editVisible = false;
var editorInitialized = false;

var editorApp = {
    onSaveSuccess: function (json) {
        updateMeta(client.meta);
    },

    setDoc: function (json) {
        doc.editor.value = json.blob.markdown;
        onEditChange();
        updateMeta(json);
    },

    getDoc: function() {
        return {
            blob: {
                version: 1,
                markdown: doc.editor.value
            },
            readers: ['public']
        };
    },

    onUserChange: function() {
        initUserData();
    },

    onError: function(status, message) {
        return true;
    }
};

var lessonApp = {
    getDoc: function() {
        return {
            blob: {version: 1},
            title: client.username + " challenge data.",
            readers: ['public']
        };
    },

    setDoc: function (json) {
    }
};

function onEditorReady() {
    handleAppCache();
    doc = dom.bindIDs();
    client = new clientLib.Client(editorApp, {saveInterval: 0});
    client.addAppBar();

    $(doc.edit).click(toggleEditor);

    setInterval(onEditChange, syncTime * 1000);
}

function onLessonReady() {
    handleAppCache();
    doc = dom.bindIDs();
    client = new clientLib.Client(lessonApp, {oneDocPerUser: true});
    client.addAppBar();
}

function onEditChange() {
    var newText = doc.editor.value;
    if (newText == lastText) {
        return;
    }
    client.setDirty();
    lastText = newText;
    try {
        doc.output.innerHTML = markdown.makeHtml(newText);
        nsdoc.updateScriptSections(doc.output);
        nsdoc.updateChallenges(doc.output);
    } catch (e) {
        $(doc.output).text("Render error: " + e.message);
    }
}

function toggleEditor(evt) {
    editVisible = !editVisible;
    if (editVisible) {
        $(doc.page).addClass('edit');
        // Binding this in the onReady function does not work
        // since the original textarea is hidden.
        if (!editorInitialized) {
            editorInitialized = true;
            $(doc.editor)
                .bind('keyup', onEditChange)
                .autoResize({limit: 10000});
        }
    } else {
        $(doc.page).removeClass('edit');
    }
    $(doc.edit).val(editVisible ? 'hide' : 'edit');
}

function updateMeta(json) {
    document.title = json.title;
    $('#title').text(json.title);
}

// For offline - capable applications
function handleAppCache() {
    if (typeof applicationCache == 'undefined') {
        return;
    }

    if (applicationCache.status == applicationCache.UPDATEREADY) {
        applicationCache.swapCache();
        location.reload();
        return;
    }

    applicationCache.addEventListener('updateready', handleAppCache, false);
}

function initUserData() {
    if (!client.username) {
        alert("Sign In to save your code.");
        return;
    }
}
