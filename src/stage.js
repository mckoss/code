/*globals Showdown */
namespace.module('com.pageforest.code.stage', function(exports, require) {
    var dom = require('org.startpad.dom');
    var clientLib = require('com.pageforest.client');
    var string = require('org.startpad.string');
    var format = require('org.startpad.format');

    exports.extend({
        'main': main
    });

    var client;
    var markdown = new Showdown.converter();
    var editVisible = false;
    var editorInitialized = false;

    var doc;

    function Stage() {
    }

    Stage.methods({
      setDoc: function (json) {
        $(doc.editor).val(json.blob.sourceCode || '');
        $(doc.display).text(doc.editor.value);
      },

      getDoc: function () {
        return {
          blob: {
            version: 1,
            sourceCode: doc.editor.value
          },
          readers: ['public']
        };
      }		
    });

    function main() {
		handleAppCache();
        doc = dom.bindIDs();
        stage = new Stage();
        client = new clientLib.Client(stage);
        client.addAppBar();
        $(doc.edit).click(toggleEditor);
        $(doc.exec).click(function () {
            evalString($(doc['command-line']).val());
        });
        $(doc.run).click(function () {
            evalString($(doc.editor).val());
        });
        $(doc['command-line']).keydown(function (evt) {
            if (evt.keyCode == 13) {
                evt.preventDefault();
                evalString($(doc['command-line']).val());
            }
        });
    }
    
    function toggleEditor(evt) {
        editVisible = !editVisible;
        if (editVisible) {
            $(doc.page).addClass('edit');
            // Binding this in the onReady function does not work
            // since the original textarea is hidden.
            if (!editorInitialized) {
                editorInitialized = true;
                $(doc.editor).autoResize({limit: 10000});
            }
        } else {
            $(doc.display).text(doc.editor.value);
            $(doc.page).removeClass('edit');
        }
        $(doc.edit).val(editVisible ? 'Hide' : 'Edit');
    }
    
    var context = {};
     
    function evalString(s) {
        return eval(s);
    }

    function write(s) {
        s = string.format.apply(undefined, arguments);
        s = '\n' + format.escapeHTML(s);
        var $text = $(doc['output-text']);
        $text.append(s)
        $(doc.output).scrollTop($text.height());
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

});
