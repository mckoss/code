var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var types = require('org.startpad.types');
var nsdoc = require('org.startpad.nsdoc');
var markdown = new Showdown.converter();
var logging = require('org.startpad.logging');

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
var challengeStatus = [];

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

        logging.init(client.username, client.storage, this.lessonLoaded);
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
                version: 2,
                lessonId: this.lessonLoaded,
                challenges: [],
                status: challengeStatus
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
        this.updateChallenges(json.blob);
    },

    updateChallenges: function (blob) {
        if (blob.challenges == undefined) {
            return;
        }
        challengeStatus = blob.status || [];
        var challenges = $('textarea.challenge', doc.output);
        for (var i = 0; i < challenges.length; i++) {
            if (blob.challenges[i]) {
                $('#challenge_' + i)
                    .val(blob.challenges[i])
                    .trigger('change.dynSiz')
                    .trigger('keyup');
            }
        }
    },

    onUserChange: function (username) {
        var self = this;
        this.hasUserDoc = false;
        if (username) {
            // TODO: Don't write doc each time - test to see if need be created?
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
        nsdoc.updateChallenges(doc.output, onChallenge);
    } catch (e) {
        $(doc.output).text("Render error: " + e.message);
        console.log("Render error: " + e.message + '\n' + e.stack);
    }
}

function onChallenge(event, challengeNumber, data) {
    var status;
    if (challengeStatus[challengeNumber] == undefined) {
        challengeStatus[challengeNumber] = {};
    }
    status = challengeStatus[challengeNumber];

    console.log("onChallenge (" + challengeNumber + "): " + event + ', ' + data);
    switch (event) {
    case 'running':
        // We don't want to update the running counter until the user's document is dirty
        if (!client.isDirty()) {
            return;
        }
        status.runCount = (status.runCount || 0) + 1;
         if (status.runCount % 10 == 1) {
             logging.log('running', types.extend({challenge: challengeNumber}, status));
        }
        break;
    case 'done':
        status.passed = status.passed || 0;
        var oldPassed = status.passed;
        status.total = data.total;
        if (data.passed > status.passed) {
            status.passed = data.passed;
            var eventType = (status.passed == status.total) ? 'complete' : 'progress';
            logging.log(eventType, types.extend({challenge: challengeNumber}, status));
        }
        break;
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
