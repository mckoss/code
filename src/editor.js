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
    getDocid: function () {
        // Only return a docid when all conditions are conducive to
        // saving a user blob for the lesson.
        this.lessonId = window.location.hash.substr(1);
        if (this.lessonId != '' && this.lessonLoading != this.lessonId) {
            this.loadLesson();
        }

        if (!this.hasUserDoc || !this.lessonLoaded || this.lessonId != this.lessonLoaded) {
            return undefined;
        }

        return client.username + '/' + this.lessonLoaded;
    },

    setDocid: function (docid) {
    },

    onError: function (status, message) {
        if (status == 'ajax_error/404') {
            return true;
        }
    },

    loadLesson: function () {
        var self = this;
        this.lessonLoading = this.lessonId;
        client.storage.getDoc(this.lessonLoading, undefined, function (json) {
            console.log("loaded lesson: " + self.lessonLoading);
            updateMeta(json);
            self.lessonLoaded = self.lessonLoading;
            renderMarkdown(json.blob.markdown);
        });
    },

    getDoc: function() {
        if (!this.lessonLoaded) {
            return {blob: {}};
        }
        var json = {
            title: this.lessonLoaded,
            blob: {
                version: 1,
                lessonId: this.lessonLoaded,
                challenges: []
            }};
        var challenges = $('textarea.challenge', doc.output);
        for (var i = 0; i < challenges.length; i++) {
            // Beware phantom text areas
            if (challenges[i].id == '') {
                continue;
            }
            json.blob.challenges.push(challenges[i].value);
        }
        return json;
    },

    setDoc: function (json) {
        console.log("setDoc");
        this.updateChallenges(json);
    },

    updateChallenges: function (json) {
        if (json.blob.challenges == undefined) {
            return;
        }
        var challenges = $('textarea.challenge', doc.output);
        for (var i = 0; i < challenges.length; i++) {
            if (json.blob.challenges[i]) {
                $('#challenge_' + i)
                    .val(json.blob.challenges[i])
                    .trigger('change.dynSiz')
                    .trigger('keyup');
            }
        }
    },

    onUserChange: function (username) {
        var self = this;
        this.hasUserDoc = false;
        if (username) {
            client.storage.putDoc(username,
                                  {title: 'Code Challenges for ' + username,
                                   blob: {
                                       version: 1
                                   }}, undefined, function () {
                self.hasUserDoc = true;
            });
        }
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
    client = new clientLib.Client(lessonApp);
    client.addAppBar();
}

function onEditChange() {
    var newText = doc.editor.value;
    if (newText == lastText) {
        return;
    }
    client.setDirty();
    lastText = newText;
    renderMarkdown(newText);
}

function renderMarkdown(newText) {
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
