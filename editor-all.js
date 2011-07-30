/* Source: src/namespace-plus.js */
/* Namespace.js - modular namespaces in JavaScript

   by Mike Koss - placed in the public domain
*/

(function(global) {
    var globalNamespace = global['namespace'];
    var VERSION = '3.0.1';

    function Module() {}

    function numeric(s) {
        if (!s) {
            return 0;
        }
        var a = s.split('.');
        return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
    }

    if (globalNamespace) {
        if (numeric(VERSION) <= numeric(globalNamespace['VERSION'])) {
            return;
        }
        Module = globalNamespace.constructor;
    } else {
        global['namespace'] = globalNamespace = new Module();
    }
    globalNamespace['VERSION'] = VERSION;

    function require(path) {
        path = path.replace(/-/g, '_');
        var parts = path.split('.');
        var ns = globalNamespace;
        for (var i = 0; i < parts.length; i++) {
            if (ns[parts[i]] === undefined) {
                ns[parts[i]] = new Module();
            }
            ns = ns[parts[i]];
        }
        return ns;
    }

    var proto = Module.prototype;

    proto['module'] = function(path, closure) {
        var exports = require(path);
        if (closure) {
            closure(exports, require);
        }
        return exports;
    };

    proto['extend'] = function(exports) {
        for (var sym in exports) {
            if (exports.hasOwnProperty(sym)) {
                this[sym] = exports[sym];
            }
        }
    };
}(this));
namespace.module('org.startpad.types', function (exports, require) {
    exports.extend({
        'VERSION': '0.1.0',
        'isArguments': function (value) { return isType(value, 'arguments'); },
        'isArray': function (value) { return isType(value, 'array'); },
        'copyArray': copyArray,
        'isType': isType,
        'typeOf': typeOf,
        'extend': extend,
        'project': project,
        'getFunctionName': getFunctionName
    });

    // Can be used to copy Arrays and Arguments into an Array
    function copyArray(arg) {
        return Array.prototype.slice.call(arg);
    }

    var baseTypes = ['number', 'string', 'boolean', 'array', 'function', 'date',
                     'regexp', 'arguments', 'undefined', 'null'];

    function internalType(value) {
        return Object.prototype.toString.call(value).match(/\[object (.*)\]/)[1].toLowerCase();
    }

    function isType(value, type) {
        return typeOf(value) == type;
    }

    // Return one of the baseTypes as a string
    function typeOf(value) {
        if (value === undefined) {
            return 'undefined';
        }
        if (value === null) {
            return 'null';
        }
        var type = internalType(value);
        if (baseTypes.indexOf(type) == -1) {
            type = typeof(value);
        }
        return type;
    }

    // IE 8 has bug that does not enumerates even own properties that have
    // these internal names.
    var enumBug = !{toString: true}.propertyIsEnumerable('toString');
    var internalNames = ['toString', 'toLocaleString', 'valueOf',
                         'constructor', 'isPrototypeOf'];

    // Copy the (own) properties of all the arguments into the first one (in order).
    function extend(dest) {
        var i, j;
        var source;
        var prop;

        if (dest === undefined) {
            dest = {};
        }
        for (i = 1; i < arguments.length; i++) {
            source = arguments[i];
            for (prop in source) {
                if (source.hasOwnProperty(prop)) {
                    dest[prop] = source[prop];
                }
            }
            if (!enumBug) {
                continue;
            }
            for (j = 0; j < internalNames.length; j++) {
                prop = internalNames[j];
                if (source.hasOwnProperty(prop)) {
                    dest[prop] = source[prop];
                }
            }
        }
        return dest;
    }

    // Return new object with just the listed properties "projected"
    // into the new object.  Ignore undefined properties.
    function project(obj, props) {
        var result = {};
        for (var i = 0; i < props.length; i++) {
            var name = props[i];
            if (obj && obj.hasOwnProperty(name)) {
                result[name] = obj[name];
            }
        }
        return result;
    }

    function getFunctionName(fn) {
        if (typeof fn != 'function') {
            return undefined;
        }
        var result = fn.toString().match(/function\s*(\S+)\s*\(/);
        if (!result) {
            return '';
        }
        return result[1];
    }

});
namespace.module('org.startpad.funcs', function (exports, require) {
    var types = require('org.startpad.types');

    exports.extend({
        'VERSION': '0.2.1',
        'methods': methods,
        'bind': bind,
        'decorate': decorate,
        'shadow': shadow,
        'subclass': subclass,
        'numericVersion': numericVersion,
        'monkeyPatch': monkeyPatch,
        'patch': patch
    });

    // Convert 3-part version number to comparable integer.
    // Note: No part should be > 99.
    function numericVersion(s) {
        if (!s) {
            return 0;
        }
        var a = s.split('.');
        return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
    }

    // Monkey patch additional methods to constructor prototype, but only
    // if patch version is newer than current patch version.
    function monkeyPatch(ctor, by, version, patchMethods) {
        if (ctor._patches) {
            var patchVersion = ctor._patches[by];
            if (numericVersion(patchVersion) >= numericVersion(version)) {
                return;
            }
        }
        ctor._patches = ctor._patches || {};
        ctor._patches[by] = version;
        methods(ctor, patchMethods);
    }

    function patch() {
        monkeyPatch(Function, 'org.startpad.funcs', exports.VERSION, {
            'methods': function (obj) { methods(this, obj); },
            'curry': function () {
                var args = [this, undefined].concat(types.copyArray(arguments));
                return bind.apply(undefined, args);
             },
            'curryThis': function (self) {
                var args = types.copyArray(arguments);
                args.unshift(this);
                return bind.apply(undefined, args);
             },
            'decorate': function (decorator) {
                return decorate(this, decorator);
            },
            'subclass': function(parent, extraMethods) {
                return subclass(this, parent, extraMethods);
            }
        });
        return exports;
    }

    // Copy methods to a Constructor Function's prototype
    function methods(ctor, obj) {
        types.extend(ctor.prototype, obj);
    }

    // Bind 'this' and/or arguments and return new function.
    // Differs from native bind (if present) in that undefined
    // parameters are merged.
    function bind(fn, self) {
        var presets;

        // Handle the monkey-patched and in-line forms of curry
        if (arguments.length == 3 && types.isArguments(arguments[2])) {
            presets = Array.prototype.slice.call(arguments[2], self1);
        } else {
            presets = Array.prototype.slice.call(arguments, 2);
        }

        function merge(a1, a2) {
            var merged = types.copyArray(a1);
            a2 = types.copyArray(a2);
            for (var i = 0; i < merged.length; i++) {
                if (merged[i] === undefined) {
                    merged[i] = a2.shift();
                }
            }
            return merged.concat(a2);
        }

        return function curried() {
            return fn.apply(self || this, merge(presets, arguments));
        };
    }

    // Wrap the fn function with a generic decorator like:
    //
    // function decorator(fn, arguments, wrapper) {
    //   if (fn == undefined) { ... init ...; return;}
    //   ...
    //   result = fn.apply(this, arguments);
    //   ...
    //   return result;
    // }
    //
    // The decorated function is created for each call
    // of the decorate function.  In addition to wrapping
    // the decorated function, it can be used to save state
    // information between calls by adding properties to it.
    function decorate(fn, decorator) {
        function decorated() {
            return decorator.call(this, fn, arguments, decorated);
        }
        // Init call - pass undefined fn - but available in this
        // if needed.
        decorator.call(fn, undefined, arguments, decorated);
        return decorated;
    }

    // Create an empty object whose __proto__ points to the given object.
    // It's properties will "shadow" those of the given object until modified.
    function shadow(obj) {
        function Dummy() {}
        Dummy.prototype = obj;
        return new Dummy();
    }

    // Classical JavaScript inheritance pattern.
    function subclass(ctor, parent, extraMethods) {
        ctor.prototype = shadow(parent.prototype);
        ctor.prototype.constructor = ctor;
        ctor.prototype._super = parent;
        ctor.prototype._proto = parent.prototype;
        methods(ctor, extraMethods);
    }

});
namespace.module('org.startpad.string', function (exports, require) {
  var funcs = require('org.startpad.funcs');

  exports.extend({
    'VERSION': '0.1.2',
    'patch': patch,
    'format': format
  });

  function patch() {
      funcs.monkeyPatch(String, 'org.startpad.string', exports.VERSION, {
          'format': function formatFunction () {
              if (arguments.length == 1 && typeof arguments[0] == 'object') {
                  return format(this, arguments[0]);
              } else {
                  return format(this, arguments);
              }
            }
      });
      return exports;
  }

  var reFormat = /\{\s*([^} ]+)\s*\}/g;

  // Format a string using values from a dictionary or array.
  // {n} - positional arg (0 based)
  // {key} - object property (first match)
  // .. same as {0.key}
  // {key1.key2.key3} - nested properties of an object
  // keys can be numbers (0-based index into an array) or
  // property names.
  function format(st, args, re) {
      re = re || reFormat;
      if (st == undefined) {
          return "undefined";
      }
      st = st.toString();
      st = st.replace(re, function(whole, key) {
          var value = args;
          var keys = key.split('.');
          for (var i = 0; i < keys.length; i++) {
              key = keys[i];
              var n = parseInt(key);
              if (!isNaN(n)) {
                  value = value[n];
              } else {
                  value = value[key];
              }
              if (value == undefined) {
                  return "";
              }
          }
          // Implicit toString() on this.
          return value;
      });
      return st;
  }

});
/* Source: src/showdown.js */
//
// showdown.js -- A javascript port of Markdown.
//
// Copyright (c) 2007 John Fraser.
//
// Original Markdown Copyright (c) 2004-2005 John Gruber
//   <http://daringfireball.net/projects/markdown/>
//
// Redistributable under a BSD-style open source license.
// See license.txt for more information.
//
// The full source distribution is at:
//
//				A A L
//				T C A
//				T K B
//
//   <http://www.attacklab.net/>
//

//
// Wherever possible, Showdown is a straight, line-by-line port
// of the Perl version of Markdown.
//
// This is not a normal parser design; it's basically just a
// series of string substitutions.  It's hard to read and
// maintain this way,  but keeping Showdown close to the original
// design makes it easier to port new features.
//
// More importantly, Showdown behaves like markdown.pl in most
// edge cases.  So web applications can do client-side preview
// in Javascript, and then build identical HTML on the server.
//
// This port needs the new RegExp functionality of ECMA 262,
// 3rd Edition (i.e. Javascript 1.5).  Most modern web browsers
// should do fine.  Even with the new regular expression features,
// We do a lot of work to emulate Perl's regex functionality.
// The tricky changes in this file mostly have the "attacklab:"
// label.  Major or self-explanatory changes don't.
//
// Smart diff tools like Araxis Merge will be able to match up
// this file with markdown.pl in a useful way.  A little tweaking
// helps: in a copy of markdown.pl, replace "#" with "//" and
// replace "$text" with "text".  Be sure to ignore whitespace
// and line endings.
//


//
// Showdown usage:
//
//   var text = "Markdown *rocks*.";
//
//   var converter = new Showdown.converter();
//   var html = converter.makeHtml(text);
//
//   alert(html);
//
// Note: move the sample code to the bottom of this
// file before uncommenting it.
//


//
// Showdown namespace
//
var Showdown = {};

//
// converter
//
// Wraps all "globals" so that the only thing
// exposed is makeHtml().
//
Showdown.converter = function() {

//
// Globals:
//

// Global hashes, used by various utility routines
var g_urls;
var g_titles;
var g_html_blocks;

// Used to track when we're inside an ordered or unordered list
// (see _ProcessListItems() for details):
var g_list_level = 0;


this.makeHtml = function(text) {
//
// Main function. The order in which other subs are called here is
// essential. Link and image substitutions need to happen before
// _EscapeSpecialCharsWithinTagAttributes(), so that any *'s or _'s in the <a>
// and <img> tags get encoded.
//

	// Clear the global hashes. If we don't clear these, you get conflicts
	// from other articles when generating a page which contains more than
	// one article (e.g. an index page that shows the N most recent
	// articles):
	g_urls = new Array();
	g_titles = new Array();
	g_html_blocks = new Array();

	// attacklab: Replace ~ with ~T
	// This lets us use tilde as an escape char to avoid md5 hashes
	// The choice of character is arbitray; anything that isn't
    // magic in Markdown will work.
	text = text.replace(/~/g,"~T");

	// attacklab: Replace $ with ~D
	// RegExp interprets $ as a special character
	// when it's in a replacement string
	text = text.replace(/\$/g,"~D");

	// Standardize line endings
	text = text.replace(/\r\n/g,"\n"); // DOS to Unix
	text = text.replace(/\r/g,"\n"); // Mac to Unix

	// Make sure text begins and ends with a couple of newlines:
	text = "\n\n" + text + "\n\n";

	// Convert all tabs to spaces.
	text = _Detab(text);

	// Strip any lines consisting only of spaces and tabs.
	// This makes subsequent regexen easier to write, because we can
	// match consecutive blank lines with /\n+/ instead of something
	// contorted like /[ \t]*\n+/ .
	text = text.replace(/^[ \t]+$/mg,"");

	// Turn block-level HTML blocks into hash entries
	text = _HashHTMLBlocks(text);

	// Strip link definitions, store in hashes.
	text = _StripLinkDefinitions(text);

	text = _RunBlockGamut(text);

	text = _UnescapeSpecialChars(text);

	// attacklab: Restore dollar signs
	text = text.replace(/~D/g,"$$");

	// attacklab: Restore tildes
	text = text.replace(/~T/g,"~");

	return text;
}


var _StripLinkDefinitions = function(text) {
//
// Strips link definitions from text, stores the URLs and titles in
// hash references.
//

	// Link defs are in the form: ^[id]: url "optional title"

	/*
		var text = text.replace(/
				^[ ]{0,3}\[(.+)\]:  // id = $1  attacklab: g_tab_width - 1
				  [ \t]*
				  \n?				// maybe *one* newline
				  [ \t]*
				<?(\S+?)>?			// url = $2
				  [ \t]*
				  \n?				// maybe one newline
				  [ \t]*
				(?:
				  (\n*)				// any lines skipped = $3 attacklab: lookbehind removed
				  ["(]
				  (.+?)				// title = $4
				  [")]
				  [ \t]*
				)?					// title is optional
				(?:\n+|$)
			  /gm,
			  function(){...});
	*/
	var text = text.replace(/^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|\Z)/gm,
		function (wholeMatch,m1,m2,m3,m4) {
			m1 = m1.toLowerCase();
			g_urls[m1] = _EncodeAmpsAndAngles(m2);  // Link IDs are case-insensitive
			if (m3) {
				// Oops, found blank lines, so it's not a title.
				// Put back the parenthetical statement we stole.
				return m3+m4;
			} else if (m4) {
				g_titles[m1] = m4.replace(/"/g,"&quot;");
			}

			// Completely remove the definition from the text
			return "";
		}
	);

	return text;
}


var _HashHTMLBlocks = function(text) {
	// attacklab: Double up blank lines to reduce lookaround
	text = text.replace(/\n/g,"\n\n");

	// Hashify HTML blocks:
	// We only want to do this for block-level HTML tags, such as headers,
	// lists, and tables. That's because we still want to wrap <p>s around
	// "paragraphs" that are wrapped in non-block-level tags, such as anchors,
	// phrase emphasis, and spans. The list of tags we're looking for is
	// hard-coded:
	var block_tags_a = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del"
	var block_tags_b = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math"

	// First, look for nested blocks, e.g.:
	//   <div>
	//     <div>
	//     tags for inner block must be indented.
	//     </div>
	//   </div>
	//
	// The outermost tags must start at the left margin for this to match, and
	// the inner nested divs must be indented.
	// We need to do this before the next, more liberal match, because the next
	// match will start at the first `<div>` and stop at the first `</div>`.

	// attacklab: This regex can be expensive when it fails.
	/*
		var text = text.replace(/
		(						// save in $1
			^					// start of line  (with /m)
			<($block_tags_a)	// start tag = $2
			\b					// word break
								// attacklab: hack around khtml/pcre bug...
			[^\r]*?\n			// any number of lines, minimally matching
			</\2>				// the matching end tag
			[ \t]*				// trailing spaces/tabs
			(?=\n+)				// followed by a newline
		)						// attacklab: there are sentinel newlines at end of document
		/gm,function(){...}};
	*/
	text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)\b[^\r]*?\n<\/\2>[ \t]*(?=\n+))/gm,hashElement);

	//
	// Now match more liberally, simply from `\n<tag>` to `</tag>\n`
	//

	/*
		var text = text.replace(/
		(						// save in $1
			^					// start of line  (with /m)
			<($block_tags_b)	// start tag = $2
			\b					// word break
								// attacklab: hack around khtml/pcre bug...
			[^\r]*?				// any number of lines, minimally matching
			.*</\2>				// the matching end tag
			[ \t]*				// trailing spaces/tabs
			(?=\n+)				// followed by a newline
		)						// attacklab: there are sentinel newlines at end of document
		/gm,function(){...}};
	*/
	text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math)\b[^\r]*?.*<\/\2>[ \t]*(?=\n+)\n)/gm,hashElement);

	// Special case just for <hr />. It was easier to make a special case than
	// to make the other regex more complicated.

	/*
		text = text.replace(/
		(						// save in $1
			\n\n				// Starting after a blank line
			[ ]{0,3}
			(<(hr)				// start tag = $2
			\b					// word break
			([^<>])*?			//
			\/?>)				// the matching end tag
			[ \t]*
			(?=\n{2,})			// followed by a blank line
		)
		/g,hashElement);
	*/
	text = text.replace(/(\n[ ]{0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g,hashElement);

	// Special case for standalone HTML comments:

	/*
		text = text.replace(/
		(						// save in $1
			\n\n				// Starting after a blank line
			[ ]{0,3}			// attacklab: g_tab_width - 1
			<!
			(--[^\r]*?--\s*)+
			>
			[ \t]*
			(?=\n{2,})			// followed by a blank line
		)
		/g,hashElement);
	*/
	text = text.replace(/(\n\n[ ]{0,3}<!(--[^\r]*?--\s*)+>[ \t]*(?=\n{2,}))/g,hashElement);

	// PHP and ASP-style processor instructions (<?...?> and <%...%>)

	/*
		text = text.replace(/
		(?:
			\n\n				// Starting after a blank line
		)
		(						// save in $1
			[ ]{0,3}			// attacklab: g_tab_width - 1
			(?:
				<([?%])			// $2
				[^\r]*?
				\2>
			)
			[ \t]*
			(?=\n{2,})			// followed by a blank line
		)
		/g,hashElement);
	*/
	text = text.replace(/(?:\n\n)([ ]{0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g,hashElement);

	// attacklab: Undo double lines (see comment at top of this function)
	text = text.replace(/\n\n/g,"\n");
	return text;
}

var hashElement = function(wholeMatch,m1) {
	var blockText = m1;

	// Undo double lines
	blockText = blockText.replace(/\n\n/g,"\n");
	blockText = blockText.replace(/^\n/,"");

	// strip trailing blank lines
	blockText = blockText.replace(/\n+$/g,"");

	// Replace the element text with a marker ("~KxK" where x is its key)
	blockText = "\n\n~K" + (g_html_blocks.push(blockText)-1) + "K\n\n";

	return blockText;
};

var _RunBlockGamut = function(text) {
//
// These are all the transformations that form block-level
// tags like paragraphs, headers, and list items.
//
	text = _DoHeaders(text);

	// Do Horizontal Rules:
	var key = hashBlock("<hr />");
	text = text.replace(/^[ ]{0,2}([ ]?\*[ ]?){3,}[ \t]*$/gm,key);
	text = text.replace(/^[ ]{0,2}([ ]?\-[ ]?){3,}[ \t]*$/gm,key);
	text = text.replace(/^[ ]{0,2}([ ]?\_[ ]?){3,}[ \t]*$/gm,key);

	text = _DoLists(text);
	text = _DoCodeBlocks(text);
	text = _DoBlockQuotes(text);

	// We already ran _HashHTMLBlocks() before, in Markdown(), but that
	// was to escape raw HTML in the original Markdown source. This time,
	// we're escaping the markup we've just created, so that we don't wrap
	// <p> tags around block-level tags.
	text = _HashHTMLBlocks(text);
	text = _FormParagraphs(text);

	return text;
}


var _RunSpanGamut = function(text) {
//
// These are all the transformations that occur *within* block-level
// tags like paragraphs, headers, and list items.
//

	text = _DoCodeSpans(text);
	text = _EscapeSpecialCharsWithinTagAttributes(text);
	text = _EncodeBackslashEscapes(text);

	// Process anchor and image tags. Images must come first,
	// because ![foo][f] looks like an anchor.
	text = _DoImages(text);
	text = _DoAnchors(text);

	// Make links out of things like `<http://example.com/>`
	// Must come after _DoAnchors(), because you can use < and >
	// delimiters in inline links like [this](<url>).
	text = _DoAutoLinks(text);
	text = _EncodeAmpsAndAngles(text);
	text = _DoItalicsAndBold(text);

	// Do hard breaks:
	text = text.replace(/  +\n/g," <br />\n");

	return text;
}

var _EscapeSpecialCharsWithinTagAttributes = function(text) {
//
// Within tags -- meaning between < and > -- encode [\ ` * _] so they
// don't conflict with their use in Markdown for code, italics and strong.
//

	// Build a regex to find HTML tags and comments.  See Friedl's
	// "Mastering Regular Expressions", 2nd Ed., pp. 200-201.
	var regex = /(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi;

	text = text.replace(regex, function(wholeMatch) {
		var tag = wholeMatch.replace(/(.)<\/?code>(?=.)/g,"$1`");
		tag = escapeCharacters(tag,"\\`*_");
		return tag;
	});

	return text;
}

var _DoAnchors = function(text) {
//
// Turn Markdown link shortcuts into XHTML <a> tags.
//
	//
	// First, handle reference-style links: [link text] [id]
	//

	/*
		text = text.replace(/
		(							// wrap whole match in $1
			\[
			(
				(?:
					\[[^\]]*\]		// allow brackets nested one level
					|
					[^\[]			// or anything else
				)*
			)
			\]

			[ ]?					// one optional space
			(?:\n[ ]*)?				// one optional newline followed by spaces

			\[
			(.*?)					// id = $3
			\]
		)()()()()					// pad remaining backreferences
		/g,_DoAnchors_callback);
	*/
	text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,writeAnchorTag);

	//
	// Next, inline-style links: [link text](url "optional title")
	//

	/*
		text = text.replace(/
			(						// wrap whole match in $1
				\[
				(
					(?:
						\[[^\]]*\]	// allow brackets nested one level
					|
					[^\[\]]			// or anything else
				)
			)
			\]
			\(						// literal paren
			[ \t]*
			()						// no id, so leave $3 empty
			<?(.*?)>?				// href = $4
			[ \t]*
			(						// $5
				(['"])				// quote char = $6
				(.*?)				// Title = $7
				\6					// matching quote
				[ \t]*				// ignore any spaces/tabs between closing quote and )
			)?						// title is optional
			\)
		)
		/g,writeAnchorTag);
	*/
	text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\]\([ \t]*()<?(.*?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,writeAnchorTag);

	//
	// Last, handle reference-style shortcuts: [link text]
	// These must come last in case you've also got [link test][1]
	// or [link test](/foo)
	//

	/*
		text = text.replace(/
		(		 					// wrap whole match in $1
			\[
			([^\[\]]+)				// link text = $2; can't contain '[' or ']'
			\]
		)()()()()()					// pad rest of backreferences
		/g, writeAnchorTag);
	*/
	text = text.replace(/(\[([^\[\]]+)\])()()()()()/g, writeAnchorTag);

	return text;
}

var writeAnchorTag = function(wholeMatch,m1,m2,m3,m4,m5,m6,m7) {
	if (m7 == undefined) m7 = "";
	var whole_match = m1;
	var link_text   = m2;
	var link_id	 = m3.toLowerCase();
	var url		= m4;
	var title	= m7;

	if (url == "") {
		if (link_id == "") {
			// lower-case and turn embedded newlines into spaces
			link_id = link_text.toLowerCase().replace(/ ?\n/g," ");
		}
		url = "#"+link_id;

		if (g_urls[link_id] != undefined) {
			url = g_urls[link_id];
			if (g_titles[link_id] != undefined) {
				title = g_titles[link_id];
			}
		}
		else {
			if (whole_match.search(/\(\s*\)$/m)>-1) {
				// Special case for explicit empty url
				url = "";
			} else {
				return whole_match;
			}
		}
	}

	url = escapeCharacters(url,"*_");
	var result = "<a href=\"" + url + "\"";

	if (title != "") {
		title = title.replace(/"/g,"&quot;");
		title = escapeCharacters(title,"*_");
		result +=  " title=\"" + title + "\"";
	}

	result += ">" + link_text + "</a>";

	return result;
}


var _DoImages = function(text) {
//
// Turn Markdown image shortcuts into <img> tags.
//

	//
	// First, handle reference-style labeled images: ![alt text][id]
	//

	/*
		text = text.replace(/
		(						// wrap whole match in $1
			!\[
			(.*?)				// alt text = $2
			\]

			[ ]?				// one optional space
			(?:\n[ ]*)?			// one optional newline followed by spaces

			\[
			(.*?)				// id = $3
			\]
		)()()()()				// pad rest of backreferences
		/g,writeImageTag);
	*/
	text = text.replace(/(!\[(.*?)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,writeImageTag);

	//
	// Next, handle inline images:  ![alt text](url "optional title")
	// Don't forget: encode * and _

	/*
		text = text.replace(/
		(						// wrap whole match in $1
			!\[
			(.*?)				// alt text = $2
			\]
			\s?					// One optional whitespace character
			\(					// literal paren
			[ \t]*
			()					// no id, so leave $3 empty
			<?(\S+?)>?			// src url = $4
			[ \t]*
			(					// $5
				(['"])			// quote char = $6
				(.*?)			// title = $7
				\6				// matching quote
				[ \t]*
			)?					// title is optional
		\)
		)
		/g,writeImageTag);
	*/
	text = text.replace(/(!\[(.*?)\]\s?\([ \t]*()<?(\S+?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,writeImageTag);

	return text;
}

var writeImageTag = function(wholeMatch,m1,m2,m3,m4,m5,m6,m7) {
	var whole_match = m1;
	var alt_text   = m2;
	var link_id	 = m3.toLowerCase();
	var url		= m4;
	var title	= m7;

	if (!title) title = "";

	if (url == "") {
		if (link_id == "") {
			// lower-case and turn embedded newlines into spaces
			link_id = alt_text.toLowerCase().replace(/ ?\n/g," ");
		}
		url = "#"+link_id;

		if (g_urls[link_id] != undefined) {
			url = g_urls[link_id];
			if (g_titles[link_id] != undefined) {
				title = g_titles[link_id];
			}
		}
		else {
			return whole_match;
		}
	}

	alt_text = alt_text.replace(/"/g,"&quot;");
	url = escapeCharacters(url,"*_");
	var result = "<img src=\"" + url + "\" alt=\"" + alt_text + "\"";

	// attacklab: Markdown.pl adds empty title attributes to images.
	// Replicate this bug.

	//if (title != "") {
		title = title.replace(/"/g,"&quot;");
		title = escapeCharacters(title,"*_");
		result +=  " title=\"" + title + "\"";
	//}

	result += " />";

	return result;
}


var _DoHeaders = function(text) {

	// Setext-style headers:
	//	Header 1
	//	========
	//
	//	Header 2
	//	--------
	//
	text = text.replace(/^(.+)[ \t]*\n=+[ \t]*\n+/gm,
		function(wholeMatch,m1){return hashBlock("<h1>" + _RunSpanGamut(m1) + "</h1>");});

	text = text.replace(/^(.+)[ \t]*\n-+[ \t]*\n+/gm,
		function(matchFound,m1){return hashBlock("<h2>" + _RunSpanGamut(m1) + "</h2>");});

	// atx-style headers:
	//  # Header 1
	//  ## Header 2
	//  ## Header 2 with closing hashes ##
	//  ...
	//  ###### Header 6
	//

	/*
		text = text.replace(/
			^(\#{1,6})				// $1 = string of #'s
			[ \t]*
			(.+?)					// $2 = Header text
			[ \t]*
			\#*						// optional closing #'s (not counted)
			\n+
		/gm, function() {...});
	*/

	text = text.replace(/^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm,
		function(wholeMatch,m1,m2) {
			var h_level = m1.length;
			return hashBlock("<h" + h_level + ">" + _RunSpanGamut(m2) + "</h" + h_level + ">");
		});

	return text;
}

// This declaration keeps Dojo compressor from outputting garbage:
var _ProcessListItems;

var _DoLists = function(text) {
//
// Form HTML ordered (numbered) and unordered (bulleted) lists.
//

	// attacklab: add sentinel to hack around khtml/safari bug:
	// http://bugs.webkit.org/show_bug.cgi?id=11231
	text += "~0";

	// Re-usable pattern to match any entirel ul or ol list:

	/*
		var whole_list = /
		(									// $1 = whole list
			(								// $2
				[ ]{0,3}					// attacklab: g_tab_width - 1
				([*+-]|\d+[.])				// $3 = first list item marker
				[ \t]+
			)
			[^\r]+?
			(								// $4
				~0							// sentinel for workaround; should be $
			|
				\n{2,}
				(?=\S)
				(?!							// Negative lookahead for another list item marker
					[ \t]*
					(?:[*+-]|\d+[.])[ \t]+
				)
			)
		)/g
	*/
	var whole_list = /^(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm;

	if (g_list_level) {
		text = text.replace(whole_list,function(wholeMatch,m1,m2) {
			var list = m1;
			var list_type = (m2.search(/[*+-]/g)>-1) ? "ul" : "ol";

			// Turn double returns into triple returns, so that we can make a
			// paragraph for the last item in a list, if necessary:
			list = list.replace(/\n{2,}/g,"\n\n\n");;
			var result = _ProcessListItems(list);

			// Trim any trailing whitespace, to put the closing `</$list_type>`
			// up on the preceding line, to get it past the current stupid
			// HTML block parser. This is a hack to work around the terrible
			// hack that is the HTML block parser.
			result = result.replace(/\s+$/,"");
			result = "<"+list_type+">" + result + "</"+list_type+">\n";
			return result;
		});
	} else {
		whole_list = /(\n\n|^\n?)(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/g;
		text = text.replace(whole_list,function(wholeMatch,m1,m2,m3) {
			var runup = m1;
			var list = m2;

			var list_type = (m3.search(/[*+-]/g)>-1) ? "ul" : "ol";
			// Turn double returns into triple returns, so that we can make a
			// paragraph for the last item in a list, if necessary:
			var list = list.replace(/\n{2,}/g,"\n\n\n");;
			var result = _ProcessListItems(list);
			result = runup + "<"+list_type+">\n" + result + "</"+list_type+">\n";
			return result;
		});
	}

	// attacklab: strip sentinel
	text = text.replace(/~0/,"");

	return text;
}

_ProcessListItems = function(list_str) {
//
//  Process the contents of a single ordered or unordered list, splitting it
//  into individual list items.
//
	// The $g_list_level global keeps track of when we're inside a list.
	// Each time we enter a list, we increment it; when we leave a list,
	// we decrement. If it's zero, we're not in a list anymore.
	//
	// We do this because when we're not inside a list, we want to treat
	// something like this:
	//
	//    I recommend upgrading to version
	//    8. Oops, now this line is treated
	//    as a sub-list.
	//
	// As a single paragraph, despite the fact that the second line starts
	// with a digit-period-space sequence.
	//
	// Whereas when we're inside a list (or sub-list), that line will be
	// treated as the start of a sub-list. What a kludge, huh? This is
	// an aspect of Markdown's syntax that's hard to parse perfectly
	// without resorting to mind-reading. Perhaps the solution is to
	// change the syntax rules such that sub-lists must start with a
	// starting cardinal number; e.g. "1." or "a.".

	g_list_level++;

	// trim trailing blank lines:
	list_str = list_str.replace(/\n{2,}$/,"\n");

	// attacklab: add sentinel to emulate \z
	list_str += "~0";

	/*
		list_str = list_str.replace(/
			(\n)?							// leading line = $1
			(^[ \t]*)						// leading whitespace = $2
			([*+-]|\d+[.]) [ \t]+			// list marker = $3
			([^\r]+?						// list item text   = $4
			(\n{1,2}))
			(?= \n* (~0 | \2 ([*+-]|\d+[.]) [ \t]+))
		/gm, function(){...});
	*/
	list_str = list_str.replace(/(\n)?(^[ \t]*)([*+-]|\d+[.])[ \t]+([^\r]+?(\n{1,2}))(?=\n*(~0|\2([*+-]|\d+[.])[ \t]+))/gm,
		function(wholeMatch,m1,m2,m3,m4){
			var item = m4;
			var leading_line = m1;
			var leading_space = m2;

			if (leading_line || (item.search(/\n{2,}/)>-1)) {
				item = _RunBlockGamut(_Outdent(item));
			}
			else {
				// Recursion for sub-lists:
				item = _DoLists(_Outdent(item));
				item = item.replace(/\n$/,""); // chomp(item)
				item = _RunSpanGamut(item);
			}

			return  "<li>" + item + "</li>\n";
		}
	);

	// attacklab: strip sentinel
	list_str = list_str.replace(/~0/g,"");

	g_list_level--;
	return list_str;
}


var _DoCodeBlocks = function(text) {
//
//  Process Markdown `<pre><code>` blocks.
//

	/*
		text = text.replace(text,
			/(?:\n\n|^)
			(								// $1 = the code block -- one or more lines, starting with a space/tab
				(?:
					(?:[ ]{4}|\t)			// Lines must start with a tab or a tab-width of spaces - attacklab: g_tab_width
					.*\n+
				)+
			)
			(\n*[ ]{0,3}[^ \t\n]|(?=~0))	// attacklab: g_tab_width
		/g,function(){...});
	*/

	// attacklab: sentinel workarounds for lack of \A and \Z, safari\khtml bug
	text += "~0";

	text = text.replace(/(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g,
		function(wholeMatch,m1,m2) {
			var codeblock = m1;
			var nextChar = m2;

			codeblock = _EncodeCode( _Outdent(codeblock));
			codeblock = _Detab(codeblock);
			codeblock = codeblock.replace(/^\n+/g,""); // trim leading newlines
			codeblock = codeblock.replace(/\n+$/g,""); // trim trailing whitespace

			codeblock = "<pre><code>" + codeblock + "\n</code></pre>";

			return hashBlock(codeblock) + nextChar;
		}
	);

	// attacklab: strip sentinel
	text = text.replace(/~0/,"");

	return text;
}

var hashBlock = function(text) {
	text = text.replace(/(^\n+|\n+$)/g,"");
	return "\n\n~K" + (g_html_blocks.push(text)-1) + "K\n\n";
}


var _DoCodeSpans = function(text) {
//
//   *  Backtick quotes are used for <code></code> spans.
//
//   *  You can use multiple backticks as the delimiters if you want to
//	 include literal backticks in the code span. So, this input:
//
//		 Just type ``foo `bar` baz`` at the prompt.
//
//	   Will translate to:
//
//		 <p>Just type <code>foo `bar` baz</code> at the prompt.</p>
//
//	There's no arbitrary limit to the number of backticks you
//	can use as delimters. If you need three consecutive backticks
//	in your code, use four for delimiters, etc.
//
//  *  You can use spaces to get literal backticks at the edges:
//
//		 ... type `` `bar` `` ...
//
//	   Turns to:
//
//		 ... type <code>`bar`</code> ...
//

	/*
		text = text.replace(/
			(^|[^\\])					// Character before opening ` can't be a backslash
			(`+)						// $2 = Opening run of `
			(							// $3 = The code block
				[^\r]*?
				[^`]					// attacklab: work around lack of lookbehind
			)
			\2							// Matching closer
			(?!`)
		/gm, function(){...});
	*/

	text = text.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,
		function(wholeMatch,m1,m2,m3,m4) {
			var c = m3;
			c = c.replace(/^([ \t]*)/g,"");	// leading whitespace
			c = c.replace(/[ \t]*$/g,"");	// trailing whitespace
			c = _EncodeCode(c);
			return m1+"<code>"+c+"</code>";
		});

	return text;
}


var _EncodeCode = function(text) {
//
// Encode/escape certain characters inside Markdown code runs.
// The point is that in code, these characters are literals,
// and lose their special Markdown meanings.
//
	// Encode all ampersands; HTML entities are not
	// entities within a Markdown code span.
	text = text.replace(/&/g,"&amp;");

	// Do the angle bracket song and dance:
	text = text.replace(/</g,"&lt;");
	text = text.replace(/>/g,"&gt;");

	// Now, escape characters that are magic in Markdown:
	text = escapeCharacters(text,"\*_{}[]\\",false);

// jj the line above breaks this:
//---

//* Item

//   1. Subitem

//            special char: *
//---

	return text;
}


var _DoItalicsAndBold = function(text) {

	// <strong> must go first:
	text = text.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g,
		"<strong>$2</strong>");

	text = text.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g,
		"<em>$2</em>");

	return text;
}


var _DoBlockQuotes = function(text) {

	/*
		text = text.replace(/
		(								// Wrap whole match in $1
			(
				^[ \t]*>[ \t]?			// '>' at the start of a line
				.+\n					// rest of the first line
				(.+\n)*					// subsequent consecutive lines
				\n*						// blanks
			)+
		)
		/gm, function(){...});
	*/

	text = text.replace(/((^[ \t]*>[ \t]?.+\n(.+\n)*\n*)+)/gm,
		function(wholeMatch,m1) {
			var bq = m1;

			// attacklab: hack around Konqueror 3.5.4 bug:
			// "----------bug".replace(/^-/g,"") == "bug"

			bq = bq.replace(/^[ \t]*>[ \t]?/gm,"~0");	// trim one level of quoting

			// attacklab: clean up hack
			bq = bq.replace(/~0/g,"");

			bq = bq.replace(/^[ \t]+$/gm,"");		// trim whitespace-only lines
			bq = _RunBlockGamut(bq);				// recurse

			bq = bq.replace(/(^|\n)/g,"$1  ");
			// These leading spaces screw with <pre> content, so we need to fix that:
			bq = bq.replace(
					/(\s*<pre>[^\r]+?<\/pre>)/gm,
				function(wholeMatch,m1) {
					var pre = m1;
					// attacklab: hack around Konqueror 3.5.4 bug:
					pre = pre.replace(/^  /mg,"~0");
					pre = pre.replace(/~0/g,"");
					return pre;
				});

			return hashBlock("<blockquote>\n" + bq + "\n</blockquote>");
		});
	return text;
}


var _FormParagraphs = function(text) {
//
//  Params:
//    $text - string to process with html <p> tags
//

	// Strip leading and trailing lines:
	text = text.replace(/^\n+/g,"");
	text = text.replace(/\n+$/g,"");

	var grafs = text.split(/\n{2,}/g);
	var grafsOut = new Array();

	//
	// Wrap <p> tags.
	//
	var end = grafs.length;
	for (var i=0; i<end; i++) {
		var str = grafs[i];

		// if this is an HTML marker, copy it
		if (str.search(/~K(\d+)K/g) >= 0) {
			grafsOut.push(str);
		}
		else if (str.search(/\S/) >= 0) {
			str = _RunSpanGamut(str);
			str = str.replace(/^([ \t]*)/g,"<p>");
			str += "</p>"
			grafsOut.push(str);
		}

	}

	//
	// Unhashify HTML blocks
	//
	end = grafsOut.length;
	for (var i=0; i<end; i++) {
		// if this is a marker for an html block...
		while (grafsOut[i].search(/~K(\d+)K/) >= 0) {
			var blockText = g_html_blocks[RegExp.$1];
			blockText = blockText.replace(/\$/g,"$$$$"); // Escape any dollar signs
			grafsOut[i] = grafsOut[i].replace(/~K\d+K/,blockText);
		}
	}

	return grafsOut.join("\n\n");
}


var _EncodeAmpsAndAngles = function(text) {
// Smart processing for ampersands and angle brackets that need to be encoded.

	// Ampersand-encoding based entirely on Nat Irons's Amputator MT plugin:
	//   http://bumppo.net/projects/amputator/
	text = text.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g,"&amp;");

	// Encode naked <'s
	text = text.replace(/<(?![a-z\/?\$!])/gi,"&lt;");

	return text;
}


var _EncodeBackslashEscapes = function(text) {
//
//   Parameter:  String.
//   Returns:	The string, with after processing the following backslash
//			   escape sequences.
//

	// attacklab: The polite way to do this is with the new
	// escapeCharacters() function:
	//
	// 	text = escapeCharacters(text,"\\",true);
	// 	text = escapeCharacters(text,"`*_{}[]()>#+-.!",true);
	//
	// ...but we're sidestepping its use of the (slow) RegExp constructor
	// as an optimization for Firefox.  This function gets called a LOT.

	text = text.replace(/\\(\\)/g,escapeCharacters_callback);
	text = text.replace(/\\([`*_{}\[\]()>#+-.!])/g,escapeCharacters_callback);
	return text;
}


var _DoAutoLinks = function(text) {

	text = text.replace(/<((https?|ftp|dict):[^'">\s]+)>/gi,"<a href=\"$1\">$1</a>");

	// Email addresses: <address@domain.foo>

	/*
		text = text.replace(/
			<
			(?:mailto:)?
			(
				[-.\w]+
				\@
				[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+
			)
			>
		/gi, _DoAutoLinks_callback());
	*/
	text = text.replace(/<(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi,
		function(wholeMatch,m1) {
			return _EncodeEmailAddress( _UnescapeSpecialChars(m1) );
		}
	);

	return text;
}


var _EncodeEmailAddress = function(addr) {
//
//  Input: an email address, e.g. "foo@example.com"
//
//  Output: the email address as a mailto link, with each character
//	of the address encoded as either a decimal or hex entity, in
//	the hopes of foiling most address harvesting spam bots. E.g.:
//
//	<a href="&#x6D;&#97;&#105;&#108;&#x74;&#111;:&#102;&#111;&#111;&#64;&#101;
//	   x&#x61;&#109;&#x70;&#108;&#x65;&#x2E;&#99;&#111;&#109;">&#102;&#111;&#111;
//	   &#64;&#101;x&#x61;&#109;&#x70;&#108;&#x65;&#x2E;&#99;&#111;&#109;</a>
//
//  Based on a filter by Matthew Wickline, posted to the BBEdit-Talk
//  mailing list: <http://tinyurl.com/yu7ue>
//

	// attacklab: why can't javascript speak hex?
	function char2hex(ch) {
		var hexDigits = '0123456789ABCDEF';
		var dec = ch.charCodeAt(0);
		return(hexDigits.charAt(dec>>4) + hexDigits.charAt(dec&15));
	}

	var encode = [
		function(ch){return "&#"+ch.charCodeAt(0)+";";},
		function(ch){return "&#x"+char2hex(ch)+";";},
		function(ch){return ch;}
	];

	addr = "mailto:" + addr;

	addr = addr.replace(/./g, function(ch) {
		if (ch == "@") {
		   	// this *must* be encoded. I insist.
			ch = encode[Math.floor(Math.random()*2)](ch);
		} else if (ch !=":") {
			// leave ':' alone (to spot mailto: later)
			var r = Math.random();
			// roughly 10% raw, 45% hex, 45% dec
			ch =  (
					r > .9  ?	encode[2](ch)   :
					r > .45 ?	encode[1](ch)   :
								encode[0](ch)
				);
		}
		return ch;
	});

	addr = "<a href=\"" + addr + "\">" + addr + "</a>";
	addr = addr.replace(/">.+:/g,"\">"); // strip the mailto: from the visible part

	return addr;
}


var _UnescapeSpecialChars = function(text) {
//
// Swap back in all the special characters we've hidden.
//
	text = text.replace(/~E(\d+)E/g,
		function(wholeMatch,m1) {
			var charCodeToReplace = parseInt(m1);
			return String.fromCharCode(charCodeToReplace);
		}
	);
	return text;
}


var _Outdent = function(text) {
//
// Remove one level of line-leading tabs or spaces
//

	// attacklab: hack around Konqueror 3.5.4 bug:
	// "----------bug".replace(/^-/g,"") == "bug"

	text = text.replace(/^(\t|[ ]{1,4})/gm,"~0"); // attacklab: g_tab_width

	// attacklab: clean up hack
	text = text.replace(/~0/g,"")

	return text;
}

var _Detab = function(text) {
// attacklab: Detab's completely rewritten for speed.
// In perl we could fix it by anchoring the regexp with \G.
// In javascript we're less fortunate.

	// expand first n-1 tabs
	text = text.replace(/\t(?=\t)/g,"    "); // attacklab: g_tab_width

	// replace the nth with two sentinels
	text = text.replace(/\t/g,"~A~B");

	// use the sentinel to anchor our regex so it doesn't explode
	text = text.replace(/~B(.+?)~A/g,
		function(wholeMatch,m1,m2) {
			var leadingText = m1;
			var numSpaces = 4 - leadingText.length % 4;  // attacklab: g_tab_width

			// there *must* be a better way to do this:
			for (var i=0; i<numSpaces; i++) leadingText+=" ";

			return leadingText;
		}
	);

	// clean up sentinels
	text = text.replace(/~A/g,"    ");  // attacklab: g_tab_width
	text = text.replace(/~B/g,"");

	return text;
}


//
//  attacklab: Utility functions
//


var escapeCharacters = function(text, charsToEscape, afterBackslash) {
	// First we have to escape the escape characters so that
	// we can build a character class out of them
	var regexString = "([" + charsToEscape.replace(/([\[\]\\])/g,"\\$1") + "])";

	if (afterBackslash) {
		regexString = "\\\\" + regexString;
	}

	var regex = new RegExp(regexString,"g");
	text = text.replace(regex,escapeCharacters_callback);

	return text;
}


var escapeCharacters_callback = function(wholeMatch,m1) {
	var charCodeToEscape = m1.charCodeAt(0);
	return "~E"+charCodeToEscape+"E";
}

} // end of Showdown.converter
/* Source: src/qunit.js */
/*
 * QUnit - A JavaScript Unit Testing Framework
 *
 * http://docs.jquery.com/QUnit
 *
 * Copyright (c) 2011 John Resig, Jörn Zaefferer
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * or GPL (GPL-LICENSE.txt) licenses.
 */

// Use namespace for uniform environment on browser and node.js - mck
namespace.module('com.jquery.qunit', function (exports, require) {
var window = this;

var defined = {
    setTimeout: typeof window.setTimeout !== "undefined",
    sessionStorage: (function() {
        try {
            return !!sessionStorage.getItem;
        } catch(e){
            return false;
        }
  })()
};

var testId = 0;

var Test = function(name, testName, expected, testEnvironmentArg, async, callback) {
    this.name = name;
    this.testName = testName;
    this.expected = expected;
    this.testEnvironmentArg = testEnvironmentArg;
    this.async = async;
    this.callback = callback;
    this.assertions = [];
};
Test.prototype = {
    init: function() {
        var tests = id("qunit-tests");
        if (tests) {
            var b = document.createElement("strong");
                b.innerHTML = "Running " + this.name;
            var li = document.createElement("li");
                li.appendChild( b );
                li.className = "running";
                li.id = this.id = "test-output" + testId++;
            tests.appendChild( li );
        }
    },
    setup: function() {
        if (this.module != config.previousModule) {
            if ( config.previousModule ) {
                QUnit.moduleDone( {
                    name: config.previousModule,
                    failed: config.moduleStats.bad,
                    passed: config.moduleStats.all - config.moduleStats.bad,
                    total: config.moduleStats.all
                } );
            }
            config.previousModule = this.module;
            config.moduleStats = { all: 0, bad: 0 };
            QUnit.moduleStart( {
                name: this.module
            } );
        }

        config.current = this;
        this.testEnvironment = extend({
            setup: function() {},
            teardown: function() {}
        }, this.moduleTestEnvironment);
        if (this.testEnvironmentArg) {
            extend(this.testEnvironment, this.testEnvironmentArg);
        }

        QUnit.testStart( {
            name: this.testName
        } );

        // allow utility functions to access the current test environment
        // TODO why??
        QUnit.current_testEnvironment = this.testEnvironment;

        try {
            if ( !config.pollution ) {
                saveGlobal();
            }

            this.testEnvironment.setup.call(this.testEnvironment);
        } catch(e) {
            QUnit.ok( false, "Setup failed on " + this.testName + ": " + e.message );
        }
    },
    run: function() {
        if ( this.async ) {
            QUnit.stop();
        }

        if ( config.notrycatch ) {
            this.callback.call(this.testEnvironment);
            return;
        }
        try {
            this.callback.call(this.testEnvironment);
        } catch(e) {
            fail("Test " + this.testName + " died, exception and test follows", e, this.callback);
            QUnit.ok( false, "Died on test #" + (this.assertions.length + 1) + ": " + e.message + " - " + QUnit.jsDump.parse(e) );
            // else next test will carry the responsibility
            saveGlobal();

            // Restart the tests if they're blocking
            if ( config.blocking ) {
                start();
            }
        }
    },
    teardown: function() {
        try {
            checkPollution();
            this.testEnvironment.teardown.call(this.testEnvironment);
        } catch(e) {
            QUnit.ok( false, "Teardown failed on " + this.testName + ": " + e.message );
        }
    },
    finish: function() {
        if ( this.expected && this.expected != this.assertions.length ) {
            QUnit.ok( false, "Expected " + this.expected + " assertions, but " + this.assertions.length + " were run" );
        }

        var good = 0, bad = 0,
            tests = id("qunit-tests");

        config.stats.all += this.assertions.length;
        config.moduleStats.all += this.assertions.length;

        if ( tests ) {
            var ol  = document.createElement("ol");

            for ( var i = 0; i < this.assertions.length; i++ ) {
                var assertion = this.assertions[i];

                var li = document.createElement("li");
                li.className = assertion.result ? "pass" : "fail";
                li.innerHTML = assertion.message || (assertion.result ? "okay" : "failed");
                ol.appendChild( li );

                if ( assertion.result ) {
                    good++;
                } else {
                    bad++;
                    config.stats.bad++;
                    config.moduleStats.bad++;
                }
            }

            // store result when possible
            if ( QUnit.config.reorder && defined.sessionStorage ) {
                if (bad) {
                    sessionStorage.setItem("qunit-" + this.module + "-" + this.testName, bad)
                } else {
                    sessionStorage.removeItem("qunit-" + this.testName);
                }
            }

            if (bad == 0) {
                ol.style.display = "none";
            }

            var b = document.createElement("strong");
            b.innerHTML = this.name + " <b class='counts'>(<b class='failed'>" + bad + "</b>, <b class='passed'>" + good + "</b>, " + this.assertions.length + ")</b>";

            var a = document.createElement("a");
            a.innerHTML = "Rerun";
            a.href = QUnit.url({ filter: getText([b]).replace(/\([^)]+\)$/, "").replace(/(^\s*|\s*$)/g, "") });

            addEvent(b, "click", function() {
                var next = b.nextSibling.nextSibling,
                    display = next.style.display;
                next.style.display = display === "none" ? "block" : "none";
            });

            addEvent(b, "dblclick", function(e) {
                var target = e && e.target ? e.target : window.event.srcElement;
                if ( target.nodeName.toLowerCase() == "span" || target.nodeName.toLowerCase() == "b" ) {
                    target = target.parentNode;
                }
                if ( window.location && target.nodeName.toLowerCase() === "strong" ) {
                    window.location = QUnit.url({ filter: getText([target]).replace(/\([^)]+\)$/, "").replace(/(^\s*|\s*$)/g, "") });
                }
            });

            var li = id(this.id);
            li.className = bad ? "fail" : "pass";
            li.removeChild( li.firstChild );
            li.appendChild( b );
            li.appendChild( a );
            li.appendChild( ol );

        } else {
            for ( var i = 0; i < this.assertions.length; i++ ) {
                if ( !this.assertions[i].result ) {
                    bad++;
                    config.stats.bad++;
                    config.moduleStats.bad++;
                }
            }
        }

        try {
            QUnit.reset();
        } catch(e) {
            fail("reset() failed, following Test " + this.testName + ", exception and reset fn follows", e, QUnit.reset);
        }

        QUnit.testDone( {
            name: this.testName,
            failed: bad,
            passed: this.assertions.length - bad,
            total: this.assertions.length
        } );
    },

    queue: function() {
        var test = this;
        synchronize(function() {
            test.init();
        });
        function run() {
            // each of these can by async
            synchronize(function() {
                test.setup();
            });
            synchronize(function() {
                test.run();
            });
            synchronize(function() {
                test.teardown();
            });
            synchronize(function() {
                test.finish();
            });
        }
        // defer when previous test run passed, if storage is available
        var bad = QUnit.config.reorder && defined.sessionStorage && +sessionStorage.getItem("qunit-" + this.module + "-" + this.testName);
        if (bad) {
            run();
        } else {
            synchronize(run);
        };
    }

};

var QUnit = {

    // call on start of module test to prepend name to all tests
    module: function(name, testEnvironment) {
        config.currentModule = name;
        config.currentModuleTestEnviroment = testEnvironment;
    },

    asyncTest: function(testName, expected, callback) {
        if ( arguments.length === 2 ) {
            callback = expected;
            expected = 0;
        }

        QUnit.test(testName, expected, callback, true);
    },

    test: function(testName, expected, callback, async) {
        var name = '<span class="test-name">' + testName + '</span>', testEnvironmentArg;

        if ( arguments.length === 2 ) {
            callback = expected;
            expected = null;
        }
        // is 2nd argument a testEnvironment?
        if ( expected && typeof expected === 'object') {
            testEnvironmentArg =  expected;
            expected = null;
        }

        if ( config.currentModule ) {
            name = '<span class="module-name">' + config.currentModule + "</span>: " + name;
        }

        if ( !validTest(config.currentModule + ": " + testName) ) {
            return;
        }

        var test = new Test(name, testName, expected, testEnvironmentArg, async, callback);
        test.module = config.currentModule;
        test.moduleTestEnvironment = config.currentModuleTestEnviroment;
        test.queue();
    },

    /**
     * Specify the number of expected assertions to gurantee that failed test (no assertions are run at all) don't slip through.
     */
    expect: function(asserts) {
        config.current.expected = asserts;
    },

    /**
     * Asserts true.
     * @example ok( "asdfasdf".length > 5, "There must be at least 5 chars" );
     */
    ok: function(a, msg) {
        a = !!a;
        var details = {
            result: a,
            message: msg
        };
        msg = escapeHtml(msg);
        QUnit.log(details);
        config.current.assertions.push({
            result: a,
            message: msg
        });
    },

    /**
     * Checks that the first two arguments are equal, with an optional message.
     * Prints out both actual and expected values.
     *
     * Prefered to ok( actual == expected, message )
     *
     * @example equal( format("Received {0} bytes.", 2), "Received 2 bytes." );
     *
     * @param Object actual
     * @param Object expected
     * @param String message (optional)
     */
    equal: function(actual, expected, message) {
        QUnit.push(expected == actual, actual, expected, message);
    },

    notEqual: function(actual, expected, message) {
        QUnit.push(expected != actual, actual, expected, message);
    },

    deepEqual: function(actual, expected, message) {
        QUnit.push(QUnit.equiv(actual, expected), actual, expected, message);
    },

    notDeepEqual: function(actual, expected, message) {
        QUnit.push(!QUnit.equiv(actual, expected), actual, expected, message);
    },

    strictEqual: function(actual, expected, message) {
        QUnit.push(expected === actual, actual, expected, message);
    },

    notStrictEqual: function(actual, expected, message) {
        QUnit.push(expected !== actual, actual, expected, message);
    },

    raises: function(block, expected, message) {
        var actual, ok = false;

        if (typeof expected === 'string') {
            message = expected;
            expected = null;
        }

        try {
            block();
        } catch (e) {
            actual = e;
        }

        if (actual) {
            // we don't want to validate thrown error
            if (!expected) {
                ok = true;
            // expected is a regexp
            } else if (QUnit.objectType(expected) === "regexp") {
                ok = expected.test(actual);
            // expected is a constructor
            } else if (actual instanceof expected) {
                ok = true;
            // expected is a validation function which returns true is validation passed
            } else if (expected.call({}, actual) === true) {
                ok = true;
            }
        }

        QUnit.ok(ok, message);
    },

    start: function() {
        config.semaphore--;
        if (config.semaphore > 0) {
            // don't start until equal number of stop-calls
            return;
        }
        if (config.semaphore < 0) {
            // ignore if start is called more often then stop
            config.semaphore = 0;
        }
        // A slight delay, to avoid any current callbacks
        if ( defined.setTimeout ) {
            window.setTimeout(function() {
                if ( config.timeout ) {
                    clearTimeout(config.timeout);
                }

                config.blocking = false;
                process();
            }, 13);
        } else {
            config.blocking = false;
            process();
        }
    },

    stop: function(timeout) {
        config.semaphore++;
        config.blocking = true;

        if ( timeout && defined.setTimeout ) {
            clearTimeout(config.timeout);
            config.timeout = window.setTimeout(function() {
                QUnit.ok( false, "Test timed out" );
                QUnit.start();
            }, timeout);
        }
    }
};

// Backwards compatibility, deprecated
QUnit.equals = QUnit.equal;
QUnit.same = QUnit.deepEqual;

// Maintain internal state
var config = {
    // The queue of tests to run
    queue: [],

    // block until document ready
    blocking: true,

    // by default, run previously failed tests first
    // very useful in combination with "Hide passed tests" checked
    reorder: true,

    noglobals: false,
    notrycatch: false
};

// Load paramaters
(function() {
    var location = window.location || { search: "", protocol: "file:" },
        params = location.search.slice( 1 ).split( "&" ),
        length = params.length,
        urlParams = {},
        current;

    if ( params[ 0 ] ) {
        for ( var i = 0; i < length; i++ ) {
            current = params[ i ].split( "=" );
            current[ 0 ] = decodeURIComponent( current[ 0 ] );
            // allow just a key to turn on a flag, e.g., test.html?noglobals
            current[ 1 ] = current[ 1 ] ? decodeURIComponent( current[ 1 ] ) : true;
            urlParams[ current[ 0 ] ] = current[ 1 ];
            if ( current[ 0 ] in config ) {
                config[ current[ 0 ] ] = current[ 1 ];
            }
        }
    }

    QUnit.urlParams = urlParams;
    config.filter = urlParams.filter;

    // Figure out if we're running the tests from a server or not
    QUnit.isLocal = !!(location.protocol === 'file:');
})();

// Expose the API as global variables, unless an 'exports'
// object exists, in that case we assume we're in CommonJS
if ( typeof exports === "undefined" || typeof require === "undefined" ) {
    extend(window, QUnit);
    window.QUnit = QUnit;
} else {
    extend(exports, QUnit);
    exports.QUnit = QUnit;
}

// define these after exposing globals to keep them in these QUnit namespace only
extend(QUnit, {
    config: config,

    // Initialize the configuration options
    init: function() {
        extend(config, {
            stats: { all: 0, bad: 0 },
            moduleStats: { all: 0, bad: 0 },
            started: +new Date,
            updateRate: 1000,
            blocking: false,
            autostart: true,
            autorun: false,
            filter: "",
            queue: [],
            semaphore: 0
        });

        var tests = id( "qunit-tests" ),
            banner = id( "qunit-banner" ),
            result = id( "qunit-testresult" );

        if ( tests ) {
            tests.innerHTML = "";
        }

        if ( banner ) {
            banner.className = "";
        }

        if ( result ) {
            result.parentNode.removeChild( result );
        }

        if ( tests ) {
            result = document.createElement( "p" );
            result.id = "qunit-testresult";
            result.className = "result";
            tests.parentNode.insertBefore( result, tests );
            result.innerHTML = 'Running...<br/>&nbsp;';
        }
    },

    /**
     * Resets the test setup. Useful for tests that modify the DOM.
     *
     * If jQuery is available, uses jQuery's html(), otherwise just innerHTML.
     */
    reset: function() {
        if ( window.jQuery ) {
            jQuery( "#main, #qunit-fixture" ).html( config.fixture );
        } else {
            var main = id( 'main' ) || id( 'qunit-fixture' );
            if ( main ) {
                main.innerHTML = config.fixture;
            }
        }
    },

    /**
     * Trigger an event on an element.
     *
     * @example triggerEvent( document.body, "click" );
     *
     * @param DOMElement elem
     * @param String type
     */
    triggerEvent: function( elem, type, event ) {
        if ( document.createEvent ) {
            event = document.createEvent("MouseEvents");
            event.initMouseEvent(type, true, true, elem.ownerDocument.defaultView,
                0, 0, 0, 0, 0, false, false, false, false, 0, null);
            elem.dispatchEvent( event );

        } else if ( elem.fireEvent ) {
            elem.fireEvent("on"+type);
        }
    },

    // Safe object type checking
    is: function( type, obj ) {
        return QUnit.objectType( obj ) == type;
    },

    objectType: function( obj ) {
        if (typeof obj === "undefined") {
                return "undefined";

        // consider: typeof null === object
        }
        if (obj === null) {
                return "null";
        }

        var type = Object.prototype.toString.call( obj )
            .match(/^\[object\s(.*)\]$/)[1] || '';

        switch (type) {
                case 'Number':
                        if (isNaN(obj)) {
                                return "nan";
                        } else {
                                return "number";
                        }
                case 'String':
                case 'Boolean':
                case 'Array':
                case 'Date':
                case 'RegExp':
                case 'Function':
                        return type.toLowerCase();
        }
        if (typeof obj === "object") {
                return "object";
        }
        return undefined;
    },

    push: function(result, actual, expected, message) {
        var details = {
            result: result,
            message: message,
            actual: actual,
            expected: expected
        };

        message = escapeHtml(message) || (result ? "okay" : "failed");
        message = '<span class="test-message">' + message + "</span>";
        expected = escapeHtml(QUnit.jsDump.parse(expected));
        actual = escapeHtml(QUnit.jsDump.parse(actual));
        var output = message + '<table><tr class="test-expected"><th>Expected: </th><td><pre>' + expected + '</pre></td></tr>';
        if (actual != expected) {
            output += '<tr class="test-actual"><th>Result: </th><td><pre>' + actual + '</pre></td></tr>';
            output += '<tr class="test-diff"><th>Diff: </th><td><pre>' + QUnit.diff(expected, actual) +'</pre></td></tr>';
        }
        if (!result) {
            var source = sourceFromStacktrace();
            if (source) {
                details.source = source;
                output += '<tr class="test-source"><th>Source: </th><td><pre>' + source +'</pre></td></tr>';
            }
        }
        output += "</table>";

        QUnit.log(details);

        config.current.assertions.push({
            result: !!result,
            message: output
        });
    },

    url: function( params ) {
        params = extend( extend( {}, QUnit.urlParams ), params );
        var querystring = "?",
            key;
        for ( key in params ) {
            querystring += encodeURIComponent( key ) + "=" +
                encodeURIComponent( params[ key ] ) + "&";
        }
        return window.location.pathname + querystring.slice( 0, -1 );
    },

    // Logging callbacks; all receive a single argument with the listed properties
    // run test/logs.html for any related changes
    begin: function() {},
    // done: { failed, passed, total, runtime }
    done: function() {},
    // log: { result, actual, expected, message }
    log: function() {},
    // testStart: { name }
    testStart: function() {},
    // testDone: { name, failed, passed, total }
    testDone: function() {},
    // moduleStart: { name }
    moduleStart: function() {},
    // moduleDone: { name, failed, passed, total }
    moduleDone: function() {}
});

if ( typeof document === "undefined" || document.readyState === "complete" ) {
    config.autorun = true;
}

addEvent(window, "load", function() {
    QUnit.begin({});

    // Initialize the config, saving the execution queue
    var oldconfig = extend({}, config);
    QUnit.init();
    extend(config, oldconfig);

    config.blocking = false;

    var userAgent = id("qunit-userAgent");
    if ( userAgent ) {
        userAgent.innerHTML = navigator.userAgent;
    }
    var banner = id("qunit-header");
    if ( banner ) {
        banner.innerHTML = '<a href="' + QUnit.url({ filter: undefined }) + '"> ' + banner.innerHTML + '</a> ' +
            '<label><input name="noglobals" type="checkbox"' + ( config.noglobals ? ' checked="checked"' : '' ) + '>noglobals</label>' +
            '<label><input name="notrycatch" type="checkbox"' + ( config.notrycatch ? ' checked="checked"' : '' ) + '>notrycatch</label>';
        addEvent( banner, "change", function( event ) {
            var params = {};
            params[ event.target.name ] = event.target.checked ? true : undefined;
            window.location = QUnit.url( params );
        });
    }

    var toolbar = id("qunit-testrunner-toolbar");
    if ( toolbar ) {
        var filter = document.createElement("input");
        filter.type = "checkbox";
        filter.id = "qunit-filter-pass";
        addEvent( filter, "click", function() {
            var ol = document.getElementById("qunit-tests");
            if ( filter.checked ) {
                ol.className = ol.className + " hidepass";
            } else {
                var tmp = " " + ol.className.replace( /[\n\t\r]/g, " " ) + " ";
                ol.className = tmp.replace(/ hidepass /, " ");
            }
            if ( defined.sessionStorage ) {
                if (filter.checked) {
                    sessionStorage.setItem("qunit-filter-passed-tests",  "true");
                } else {
                    sessionStorage.removeItem("qunit-filter-passed-tests");
                }
            }
        });
        if ( defined.sessionStorage && sessionStorage.getItem("qunit-filter-passed-tests") ) {
            filter.checked = true;
            var ol = document.getElementById("qunit-tests");
            ol.className = ol.className + " hidepass";
        }
        toolbar.appendChild( filter );

        var label = document.createElement("label");
        label.setAttribute("for", "qunit-filter-pass");
        label.innerHTML = "Hide passed tests";
        toolbar.appendChild( label );
    }

    var main = id('main') || id('qunit-fixture');
    if ( main ) {
        config.fixture = main.innerHTML;
    }

    if (config.autostart) {
        QUnit.start();
    }
});

function done() {
    config.autorun = true;

    // Log the last module results
    if ( config.currentModule ) {
        QUnit.moduleDone( {
            name: config.currentModule,
            failed: config.moduleStats.bad,
            passed: config.moduleStats.all - config.moduleStats.bad,
            total: config.moduleStats.all
        } );
    }

    var banner = id("qunit-banner"),
        tests = id("qunit-tests"),
        runtime = +new Date - config.started,
        passed = config.stats.all - config.stats.bad,
        html = [
            'Tests completed in ',
            runtime,
            ' milliseconds.<br/>',
            '<span class="passed">',
            passed,
            '</span> tests of <span class="total">',
            config.stats.all,
            '</span> passed, <span class="failed">',
            config.stats.bad,
            '</span> failed.'
        ].join('');

    if ( banner ) {
        banner.className = (config.stats.bad ? "qunit-fail" : "qunit-pass");
    }

    if ( tests ) {
        id( "qunit-testresult" ).innerHTML = html;
    }

    QUnit.done( {
        failed: config.stats.bad,
        passed: passed,
        total: config.stats.all,
        runtime: runtime
    } );
}

function validTest( name ) {
    var filter = config.filter,
        run = false;

    if ( !filter ) {
        return true;
    }

    not = filter.charAt( 0 ) === "!";
    if ( not ) {
        filter = filter.slice( 1 );
    }

    if ( name.indexOf( filter ) !== -1 ) {
        return !not;
    }

    if ( not ) {
        run = true;
    }

    return run;
}

// so far supports only Firefox, Chrome and Opera (buggy)
// could be extended in the future to use something like https://github.com/csnover/TraceKit
function sourceFromStacktrace() {
    try {
        throw new Error();
    } catch ( e ) {
        if (e.stacktrace) {
            // Opera
            return e.stacktrace.split("\n")[6];
        } else if (e.stack) {
            // Firefox, Chrome
            return e.stack.split("\n")[4];
        }
    }
}

function escapeHtml(s) {
    if (!s) {
        return "";
    }
    s = s + "";
    return s.replace(/[\&"<>\\\n ]/g, function(s) {
        switch(s) {
            case "&": return "&amp;";
            case "\\": return "\\\\";
            case '"': return '\"';
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '\n': return '<br/>';
            case ' ': return '&nbsp;';
            default: return s;
        }
    });
}

function synchronize( callback ) {
    config.queue.push( callback );

    if ( config.autorun && !config.blocking ) {
        process();
    }
}

function process() {
    var start = (new Date()).getTime();

    while ( config.queue.length && !config.blocking ) {
        if ( config.updateRate <= 0 || (((new Date()).getTime() - start) < config.updateRate) ) {
            config.queue.shift()();
        } else {
            window.setTimeout( process, 13 );
            break;
        }
    }
  if (!config.blocking && !config.queue.length) {
    done();
  }
}

function saveGlobal() {
    config.pollution = [];

    if ( config.noglobals ) {
        for ( var key in window ) {
            config.pollution.push( key );
        }
    }
}

function checkPollution( name ) {
    var old = config.pollution;
    saveGlobal();

    var newGlobals = diff( old, config.pollution );
    if ( newGlobals.length > 0 ) {
        ok( false, "Introduced global variable(s): " + newGlobals.join(", ") );
        config.current.expected++;
    }

    var deletedGlobals = diff( config.pollution, old );
    if ( deletedGlobals.length > 0 ) {
        ok( false, "Deleted global variable(s): " + deletedGlobals.join(", ") );
        config.current.expected++;
    }
}

// returns a new Array with the elements that are in a but not in b
function diff( a, b ) {
    var result = a.slice();
    for ( var i = 0; i < result.length; i++ ) {
        for ( var j = 0; j < b.length; j++ ) {
            if ( result[i] === b[j] ) {
                result.splice(i, 1);
                i--;
                break;
            }
        }
    }
    return result;
}

function fail(message, exception, callback) {
    if ( typeof console !== "undefined" && console.error && console.warn ) {
        console.error(message);
        console.error(exception);
        console.warn(callback.toString());

    } else if ( window.opera && opera.postError ) {
        opera.postError(message, exception, callback.toString);
    }
}

function extend(a, b) {
    for ( var prop in b ) {
        if ( b[prop] === undefined ) {
            delete a[prop];
        } else {
            a[prop] = b[prop];
        }
    }

    return a;
}

function addEvent(elem, type, fn) {
    if ( elem.addEventListener ) {
        elem.addEventListener( type, fn, false );
    } else if ( elem.attachEvent ) {
        elem.attachEvent( "on" + type, fn );
    } else {
        fn();
    }
}

function id(name) {
    return !!(typeof document !== "undefined" && document && document.getElementById) &&
        document.getElementById( name );
}

// Test for equality any JavaScript type.
// Discussions and reference: http://philrathe.com/articles/equiv
// Test suites: http://philrathe.com/tests/equiv
// Author: Philippe Rathé <prathe@gmail.com>
QUnit.equiv = function () {

    var innerEquiv; // the real equiv function
    var callers = []; // stack to decide between skip/abort functions
    var parents = []; // stack to avoiding loops from circular referencing

    // Call the o related callback with the given arguments.
    function bindCallbacks(o, callbacks, args) {
        var prop = QUnit.objectType(o);
        if (prop) {
            if (QUnit.objectType(callbacks[prop]) === "function") {
                return callbacks[prop].apply(callbacks, args);
            } else {
                return callbacks[prop]; // or undefined
            }
        }
    }

    var callbacks = function () {

        // for string, boolean, number and null
        function useStrictEquality(b, a) {
            if (b instanceof a.constructor || a instanceof b.constructor) {
                // to catch short annotaion VS 'new' annotation of a declaration
                // e.g. var i = 1;
                //      var j = new Number(1);
                return a == b;
            } else {
                return a === b;
            }
        }

        return {
            "string": useStrictEquality,
            "boolean": useStrictEquality,
            "number": useStrictEquality,
            "null": useStrictEquality,
            "undefined": useStrictEquality,

            "nan": function (b) {
                return isNaN(b);
            },

            "date": function (b, a) {
                return QUnit.objectType(b) === "date" && a.valueOf() === b.valueOf();
            },

            "regexp": function (b, a) {
                return QUnit.objectType(b) === "regexp" &&
                    a.source === b.source && // the regex itself
                    a.global === b.global && // and its modifers (gmi) ...
                    a.ignoreCase === b.ignoreCase &&
                    a.multiline === b.multiline;
            },

            // - skip when the property is a method of an instance (OOP)
            // - abort otherwise,
            //   initial === would have catch identical references anyway
            "function": function () {
                var caller = callers[callers.length - 1];
                return caller !== Object &&
                        typeof caller !== "undefined";
            },

            "array": function (b, a) {
                var i, j, loop;
                var len;

                // b could be an object literal here
                if ( ! (QUnit.objectType(b) === "array")) {
                    return false;
                }

                len = a.length;
                if (len !== b.length) { // safe and faster
                    return false;
                }

                //track reference to avoid circular references
                parents.push(a);
                for (i = 0; i < len; i++) {
                    loop = false;
                    for(j=0;j<parents.length;j++){
                        if(parents[j] === a[i]){
                            loop = true;//dont rewalk array
                        }
                    }
                    if (!loop && ! innerEquiv(a[i], b[i])) {
                        parents.pop();
                        return false;
                    }
                }
                parents.pop();
                return true;
            },

            "object": function (b, a) {
                var i, j, loop;
                var eq = true; // unless we can proove it
                var aProperties = [], bProperties = []; // collection of strings

                // comparing constructors is more strict than using instanceof
                if ( a.constructor !== b.constructor) {
                    return false;
                }

                // stack constructor before traversing properties
                callers.push(a.constructor);
                //track reference to avoid circular references
                parents.push(a);

                for (i in a) { // be strict: don't ensures hasOwnProperty and go deep
                    loop = false;
                    for(j=0;j<parents.length;j++){
                        if(parents[j] === a[i])
                            loop = true; //don't go down the same path twice
                    }
                    aProperties.push(i); // collect a's properties

                    if (!loop && ! innerEquiv(a[i], b[i])) {
                        eq = false;
                        break;
                    }
                }

                callers.pop(); // unstack, we are done
                parents.pop();

                for (i in b) {
                    bProperties.push(i); // collect b's properties
                }

                // Ensures identical properties name
                return eq && innerEquiv(aProperties.sort(), bProperties.sort());
            }
        };
    }();

    innerEquiv = function () { // can take multiple arguments
        var args = Array.prototype.slice.apply(arguments);
        if (args.length < 2) {
            return true; // end transition
        }

        return (function (a, b) {
            if (a === b) {
                return true; // catch the most you can
            } else if (a === null || b === null || typeof a === "undefined" || typeof b === "undefined" || QUnit.objectType(a) !== QUnit.objectType(b)) {
                return false; // don't lose time with error prone cases
            } else {
                return bindCallbacks(a, callbacks, [b, a]);
            }

        // apply transition with (1..n) arguments
        })(args[0], args[1]) && arguments.callee.apply(this, args.splice(1, args.length -1));
    };

    return innerEquiv;

}();

/**
 * jsDump
 * Copyright (c) 2008 Ariel Flesler - aflesler(at)gmail(dot)com | http://flesler.blogspot.com
 * Licensed under BSD (http://www.opensource.org/licenses/bsd-license.php)
 * Date: 5/15/2008
 * @projectDescription Advanced and extensible data dumping for Javascript.
 * @version 1.0.0
 * @author Ariel Flesler
 * @link {http://flesler.blogspot.com/2008/05/jsdump-pretty-dump-of-any-javascript.html}
 */
QUnit.jsDump = (function() {
    function quote( str ) {
        return '"' + str.toString().replace(/"/g, '\\"') + '"';
    };
    function literal( o ) {
        return o + '';
    };
    function join( pre, arr, post ) {
        var s = jsDump.separator(),
            base = jsDump.indent(),
            inner = jsDump.indent(1);
        if ( arr.join )
            arr = arr.join( ',' + s + inner );
        if ( !arr )
            return pre + post;
        return [ pre, inner + arr, base + post ].join(s);
    };
    function array( arr ) {
        var i = arr.length, ret = Array(i);
        this.up();
        while ( i-- )
            ret[i] = this.parse( arr[i] );
        this.down();
        return join( '[', ret, ']' );
    };

    var reName = /^function (\w+)/;

    var jsDump = {
        parse:function( obj, type ) { //type is used mostly internally, you can fix a (custom)type in advance
            var parser = this.parsers[ type || this.typeOf(obj) ];
            type = typeof parser;

            return type == 'function' ? parser.call( this, obj ) :
                   type == 'string' ? parser :
                   this.parsers.error;
        },
        typeOf:function( obj ) {
            var type;
            if ( obj === null ) {
                type = "null";
            } else if (typeof obj === "undefined") {
                type = "undefined";
            } else if (QUnit.is("RegExp", obj)) {
                type = "regexp";
            } else if (QUnit.is("Date", obj)) {
                type = "date";
            } else if (QUnit.is("Function", obj)) {
                type = "function";
            } else if (typeof obj.setInterval !== undefined && typeof obj.document !== "undefined" && typeof obj.nodeType === "undefined") {
                type = "window";
            } else if (obj.nodeType === 9) {
                type = "document";
            } else if (obj.nodeType) {
                type = "node";
            } else if (typeof obj === "object" && typeof obj.length === "number" && obj.length >= 0) {
                type = "array";
            } else {
                type = typeof obj;
            }
            return type;
        },
        separator:function() {
            return this.multiline ? this.HTML ? '<br />' : '\n' : this.HTML ? '&nbsp;' : ' ';
        },
        indent:function( extra ) {// extra can be a number, shortcut for increasing-calling-decreasing
            if ( !this.multiline )
                return '';
            var chr = this.indentChar;
            if ( this.HTML )
                chr = chr.replace(/\t/g,'   ').replace(/ /g,'&nbsp;');
            return Array( this._depth_ + (extra||0) ).join(chr);
        },
        up:function( a ) {
            this._depth_ += a || 1;
        },
        down:function( a ) {
            this._depth_ -= a || 1;
        },
        setParser:function( name, parser ) {
            this.parsers[name] = parser;
        },
        // The next 3 are exposed so you can use them
        quote:quote,
        literal:literal,
        join:join,
        //
        _depth_: 1,
        // This is the list of parsers, to modify them, use jsDump.setParser
        parsers:{
            window: '[Window]',
            document: '[Document]',
            error:'[ERROR]', //when no parser is found, shouldn't happen
            unknown: '[Unknown]',
            'null':'null',
            'undefined':'undefined',
            'function':function( fn ) {
                var ret = 'function',
                    name = 'name' in fn ? fn.name : (reName.exec(fn)||[])[1];//functions never have name in IE
                if ( name )
                    ret += ' ' + name;
                ret += '(';

                ret = [ ret, QUnit.jsDump.parse( fn, 'functionArgs' ), '){'].join('');
                return join( ret, QUnit.jsDump.parse(fn,'functionCode'), '}' );
            },
            array: array,
            nodelist: array,
            arguments: array,
            object:function( map ) {
                var ret = [ ];
                QUnit.jsDump.up();
                for ( var key in map )
                    ret.push( QUnit.jsDump.parse(key,'key') + ': ' + QUnit.jsDump.parse(map[key]) );
                QUnit.jsDump.down();
                return join( '{', ret, '}' );
            },
            node:function( node ) {
                var open = QUnit.jsDump.HTML ? '&lt;' : '<',
                    close = QUnit.jsDump.HTML ? '&gt;' : '>';

                var tag = node.nodeName.toLowerCase(),
                    ret = open + tag;

                for ( var a in QUnit.jsDump.DOMAttrs ) {
                    var val = node[QUnit.jsDump.DOMAttrs[a]];
                    if ( val )
                        ret += ' ' + a + '=' + QUnit.jsDump.parse( val, 'attribute' );
                }
                return ret + close + open + '/' + tag + close;
            },
            functionArgs:function( fn ) {//function calls it internally, it's the arguments part of the function
                var l = fn.length;
                if ( !l ) return '';

                var args = Array(l);
                while ( l-- )
                    args[l] = String.fromCharCode(97+l);//97 is 'a'
                return ' ' + args.join(', ') + ' ';
            },
            key:quote, //object calls it internally, the key part of an item in a map
            functionCode:'[code]', //function calls it internally, it's the content of the function
            attribute:quote, //node calls it internally, it's an html attribute value
            string:quote,
            date:quote,
            regexp:literal, //regex
            number:literal,
            'boolean':literal
        },
        DOMAttrs:{//attributes to dump from nodes, name=>realName
            id:'id',
            name:'name',
            'class':'className'
        },
        HTML:false,//if true, entities are escaped ( <, >, \t, space and \n )
        indentChar:'  ',//indentation unit
        multiline:true //if true, items in a collection, are separated by a \n, else just a space.
    };

    return jsDump;
})();

// from Sizzle.js
function getText( elems ) {
    var ret = "", elem;

    for ( var i = 0; elems[i]; i++ ) {
        elem = elems[i];

        // Get the text from text nodes and CDATA nodes
        if ( elem.nodeType === 3 || elem.nodeType === 4 ) {
            ret += elem.nodeValue;

        // Traverse everything else, except comment nodes
        } else if ( elem.nodeType !== 8 ) {
            ret += getText( elem.childNodes );
        }
    }

    return ret;
};

/*
 * Javascript Diff Algorithm
 *  By John Resig (http://ejohn.org/)
 *  Modified by Chu Alan "sprite"
 *
 * Released under the MIT license.
 *
 * More Info:
 *  http://ejohn.org/projects/javascript-diff-algorithm/
 *
 * Usage: QUnit.diff(expected, actual)
 *
 * QUnit.diff("the quick brown fox jumped over", "the quick fox jumps over") == "the  quick <del>brown </del> fox <del>jumped </del><ins>jumps </ins> over"
 */
QUnit.diff = (function() {
    function diff(o, n){
        var ns = new Object();
        var os = new Object();

        for (var i = 0; i < n.length; i++) {
            if (ns[n[i]] == null)
                ns[n[i]] = {
                    rows: new Array(),
                    o: null
                };
            ns[n[i]].rows.push(i);
        }

        for (var i = 0; i < o.length; i++) {
            if (os[o[i]] == null)
                os[o[i]] = {
                    rows: new Array(),
                    n: null
                };
            os[o[i]].rows.push(i);
        }

        for (var i in ns) {
            if (ns[i].rows.length == 1 && typeof(os[i]) != "undefined" && os[i].rows.length == 1) {
                n[ns[i].rows[0]] = {
                    text: n[ns[i].rows[0]],
                    row: os[i].rows[0]
                };
                o[os[i].rows[0]] = {
                    text: o[os[i].rows[0]],
                    row: ns[i].rows[0]
                };
            }
        }

        for (var i = 0; i < n.length - 1; i++) {
            if (n[i].text != null && n[i + 1].text == null && n[i].row + 1 < o.length && o[n[i].row + 1].text == null &&
            n[i + 1] == o[n[i].row + 1]) {
                n[i + 1] = {
                    text: n[i + 1],
                    row: n[i].row + 1
                };
                o[n[i].row + 1] = {
                    text: o[n[i].row + 1],
                    row: i + 1
                };
            }
        }

        for (var i = n.length - 1; i > 0; i--) {
            if (n[i].text != null && n[i - 1].text == null && n[i].row > 0 && o[n[i].row - 1].text == null &&
            n[i - 1] == o[n[i].row - 1]) {
                n[i - 1] = {
                    text: n[i - 1],
                    row: n[i].row - 1
                };
                o[n[i].row - 1] = {
                    text: o[n[i].row - 1],
                    row: i - 1
                };
            }
        }

        return {
            o: o,
            n: n
        };
    }

    return function(o, n){
        o = o.replace(/\s+$/, '');
        n = n.replace(/\s+$/, '');
        var out = diff(o == "" ? [] : o.split(/\s+/), n == "" ? [] : n.split(/\s+/));

        var str = "";

        var oSpace = o.match(/\s+/g);
        if (oSpace == null) {
            oSpace = [" "];
        }
        else {
            oSpace.push(" ");
        }
        var nSpace = n.match(/\s+/g);
        if (nSpace == null) {
            nSpace = [" "];
        }
        else {
            nSpace.push(" ");
        }

        if (out.n.length == 0) {
            for (var i = 0; i < out.o.length; i++) {
                str += '<del>' + out.o[i] + oSpace[i] + "</del>";
            }
        }
        else {
            if (out.n[0].text == null) {
                for (n = 0; n < out.o.length && out.o[n].text == null; n++) {
                    str += '<del>' + out.o[n] + oSpace[n] + "</del>";
                }
            }

            for (var i = 0; i < out.n.length; i++) {
                if (out.n[i].text == null) {
                    str += '<ins>' + out.n[i] + nSpace[i] + "</ins>";
                }
                else {
                    var pre = "";

                    for (n = out.n[i].row + 1; n < out.o.length && out.o[n].text == null; n++) {
                        pre += '<del>' + out.o[n] + oSpace[n] + "</del>";
                    }
                    str += " " + out.n[i].text + nSpace[i] + pre;
                }
            }
        }

        return str;
    };
})();

});

/* Source: src/editor.js */
namespace.module('com.pageforest.code.editor', function (exports, require) {
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
        console.log("Render error: " + e.message + '\n' + e.stack);
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
});

/* Source: src/nsdoc.js */
namespace.module('org.startpad.nsdoc', function (exports, require) {
/*jslint evil:true */
require('org.startpad.funcs').patch();
var base = require('org.startpad.base');
var format = require('org.startpad.format');
var string = require('org.startpad.string').patch();
var ut = require('com.jquery.qunit');

exports.extend({
    'namespaceDoc': namespaceDoc,
    'updateScriptSections': updateScriptSections,
    'updateChallenges': updateChallenges
});

var reArgs = /^function\s+\S*\(([^\)]*)\)/;
var reFuncName = /function\s+(\S+)\s*\(/;
var reComma = /\s*,\s/;

var WRITE_LIMIT = 1000;

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

   REVIEW: Injecting script into DOM executes on Firefox?  Need to disable.
*/
function updateScriptSections(context) {
    var domScripts = $('script', context);
    var scripts = [];
    var i, j;
    var script;

    for (i = 0; i < domScripts.length; i++) {
        if (domScripts[i].className != '') {
            continue;
        }
        script = {script: domScripts[i],
                  fragments: [],
                  values: [],
                  lines: base.strip(domScripts[i].innerHTML).split('\n'),
                  max: 0
                 };
        scripts.push(script);
        var jBegin = 0;
        for (j = 0; j < script.lines.length; j++) {
            if (j != script.lines.length - 1 &&
                !/^\S.*;\s*$/.test(script.lines[j])) {
                continue;
            }
            script.fragments[j] = base.strip(script.lines.slice(jBegin, j + 1).join('\n'));
            script.max = Math.max(script.lines[j].length, script.max);
            jBegin = j + 1;
        }
    }

    evalScripts(scripts);

    for (i = 0; i < scripts.length; i++) {
        script = scripts[i];
        for (j = 0; j < script.lines.length; j++) {
            if (script.comments[j]) {
                script.lines[j] += format.repeat(' ', script.max - script.lines[j].length + 2) +
                    script.comments[j];
            }
        }
        $(script.script).before('<pre><code>' +
                                format.escapeHTML(script.lines.join('\n')) +
                                '</code></pre>');
        if (script.writes.length > 0) {
            $(script.script).after('<pre class="printed"><code>' +
                                   format.escapeHTML(script.writes.join('\n')) +
                                   '</code></pre>');
        }
    }
}

// Evaluate all script fragments in one function so variables set will
// carry over to subsequent fragments.  Avoid using common variable names
// that might be used by eval'ed code.
function evalScripts(_scripts) {
    var _script;
    var _value;
    var _i, _line;

    function write() {
        var args = Array.prototype.slice.call(arguments, 1);
        var s = string.format(arguments[0], args);
        while (s.length > 80) {
            _script.writes.push(s.slice(0, 80));
            s = s.slice(80);
        }
        _script.writes.push(s);
    }

    for (_i = 0; _i < _scripts.length; _i++) {
        _script = _scripts[_i];

        _script.writes = [];
        _script.comments = [];
        for (_line = 0; _line < _script.fragments.length; _line++) {
            if (!_script.fragments[_line]) {
                continue;
            }
            try {
                _value = eval(_script.fragments[_line]);
            } catch (_e) {
                _value = _e;
            }
            _script.comments[_line] = commentFromValue(_value);
        }
    }
}

function commentFromValue(value) {
    if (value == undefined) {
        return undefined;
    }
    if (value instanceof Error) {
        return "// Exception: " + value.message;
    }
    switch (typeof value) {
    case 'string':
        value = '"' + value + '"';
        value.replace(/"/g, '""');
        break;
    case 'function':
        value = "function " + getFunctionName(value);
        break;
    case 'object':
        if (value === null) {
            value = "null";
        } else {
            var prefix = getFunctionName(value.constructor) + ': ';
            try {
                value = prefix + JSON.stringify(value);
            } catch (e) {
                value += prefix + "{...}";
            }
        }
    }
    return '// ' + value.toString();
}

var tester;
var hangTimer;

function updateChallenges(context) {
    var challenges = $('script.challenge', context);
    var tests = [];
    var printed;

    console.log("updateChallenges");

    function onChallengeChange(i) {
        var test = tests[i];
        var code = test.textarea.value;
        if (code == test.codeLast) {
            return;
        }
        test.codeLast = code;

        $('#test_' + i).empty();
        $('#print_' + i).addClass('unused');
        $('code', '#print_' + i).empty();
        test.sep = '';
        test.writes = 0;
        if (hangTimer) {
            clearTimeout(hangTimer);
            hangTimer = undefined;
        }

        function terminateTest() {
            clearTimeout(hangTimer);
            hangTimer = undefined;
            tester.terminate();
            tester = undefined;
        }

        try {
            if (tester) {
                tester.terminate();
            }
            $('#test_' + i).append('<div class="test-status">Loading code.</div>');
            tester = new Worker('tester-all.js');
            tester.postMessage({challenge: i,
                                code: test.prefix + code + test.suffix,
                                test: test.testCode});
            hangTimer = setTimeout(function () {
                var $results = $('#test_' + i);
                $results.append('<div class="test-status">You may have an ' +
                                '<a target="_blank" ' +
                                'href="http://en.wikipedia.org/wiki/Infinite_loop">' +
                                'infinite loop</a>...' +
                                '</div>');
            }, 10000);
            tester.onmessage = function (event) {
                // { challenge: number, type: 'start'/'test'/'done'/'error',
                //   info: {result: string, message: string} }
                var data = event.data;
                var $results = $('#test_' + data.challenge);
                switch (data.type) {
                case 'start':
                    $results.append('<div class="test-status">Running tests.</div>');
                    break;
                case 'error':
                    $results.append('<div class="test-status FAIL">Code error: {0}</div>'
                                    .format(data.info.message));
                    terminateTest();
                    break;
                case 'done':
                    $results.append(('<div class="test-status {0}">Test Complete: ' +
                                     '{1} correct out of {2} tests.</div>')
                                    .format(
                                        data.info.failed > 0 ? 'FAIL' : 'PASS',
                                        data.info.passed,
                                        data.info.total));
                    terminateTest();
                    break;
                case 'test':
                    $results.append('<div class="test {0}">{0}: {1}<div>'
                                    .format(data.info.result ? 'PASS' : 'FAIL', data.info.message));
                    break;
                case 'write':
                    if (++test.writes > WRITE_LIMIT) {
                        $('code', '#print_' + i).append(test.sep + "Write Limit Exceeded.");
                        $results.append('<div class="test FAIL">ABORTED: ' +
                                        'Write Limit Exceeeded.<div>');
                        terminateTest();
                        return;
                    }
                    $('#print_' + i).removeClass('unused');
                    $('code', '#print_' + i).append(test.sep + format.escapeHTML(data.message));
                    test.sep = '\n';
                    break;
                }
            };
        } catch (e) {
            $('#test_' + i).append('<div class="test FAIL">{0}<div>'.format(e.toString()));
        }
    }

    for (var i = 0; i < challenges.length; i++) {
        var challenge = challenges[i];
        // Psuedo-XML (CDATA parsing not working)
        var xml = $(challenge).text();
        tests[i] = {
            prefix: getXMLText('prefix', xml),
            suffix: getXMLText('suffix', xml),
            testCode: getXMLText('test', xml),
            sep: ''
        };
        var code = getXMLText('code', xml);
        $(challenge).after('<textarea id="challenge_{0}" class="challenge"></textarea>'
                           .format(i));
        $(challenge).remove();
        var textarea = tests[i].textarea = $('#challenge_' + i)[0];
        $(textarea)
            .val(code)
            .bind('keyup', onChallengeChange.curry(i))
            .autoResize({limit: 1000});
        $(textarea).after('<pre id="print_{0}" class="printed unused"><code></code></pre>'
                           .format(i));
        $(textarea).after('<pre class="test-results" id="test_{0}"></pre>'.format(i));

        onChallengeChange(i);
    }
}

function getXMLText(tag, s) {
    var start = s.indexOf('<{0}>'.format(tag));
    var end = s.indexOf('</{0}>'.format(tag));
    if (start == -1 || end == -1) {
        return '';
    }
    return trimCode(s.slice(start + tag.length + 2, end));
}

function trimCode(s) {
    s = s.replace(/^\n+|\s+$/g, '');
    var match = /^\s+/.exec(s);
    if (match) {
        var pre = new RegExp('^\\s{' + match[0].length + '}');
        var lines = s.split('\n');
        for (var i = 0; i < lines.length; i++) {
            lines[i] = lines[i].replace(pre, '');
        }
        s = lines.join('\n');
    }
    return s + '\n';
}

});

/* Source: src/autoresize.jquery.js */
/*
 * jQuery autoResize (textarea auto-resizer)
 * @copyright James Padolsey http://james.padolsey.com
 * @version 1.04
 */

(function($){

    $.fn.autoResize = function(options) {

        // Just some abstracted details,
        // to make plugin users happy:
        var settings = $.extend({
            onResize : function(){},
            animate : true,
            animateDuration : 150,
            animateCallback : function(){},
            extraSpace : 20,
            limit: 1000
        }, options);

        // Only textarea's auto-resize:
        this.filter('textarea').each(function(){

                // Get rid of scrollbars and disable WebKit resizing:
            var textarea = $(this).css({resize:'none','overflow-y':'hidden'}),

                // Cache original height, for use later:
                origHeight = textarea.height(),

                // Need clone of textarea, hidden off screen:
                clone = (function(){

                    // Properties which may effect space taken up by chracters:
                    var props = ['height','width','lineHeight','textDecoration','letterSpacing'],
                        propOb = {};

                    // Create object of styles to apply:
                    $.each(props, function(i, prop){
                        propOb[prop] = textarea.css(prop);
                    });

                    // Clone the actual textarea removing unique properties
                    // and insert before original textarea:
                    return textarea.clone().removeAttr('id').removeAttr('name').css({
                        position: 'absolute',
                        top: 0,
                        left: -9999
                    }).css(propOb).attr('tabIndex','-1').insertBefore(textarea);

                })(),
                lastScrollTop = null,
                updateSize = function() {

                    // Prepare the clone:
                    clone.height(0).val($(this).val()).scrollTop(10000);

                    // Find the height of text:
                    var scrollTop = Math.max(clone.scrollTop(), origHeight) + settings.extraSpace,
                        toChange = $(this).add(clone);

                    // Check for limit:
                    if ( scrollTop >= settings.limit ) {
                        $(this).css('overflow-y','');
                        scrollTop = settings.limit;
                    }

                    // Don't do anything if scrollTop hasen't changed:
                    if (lastScrollTop === scrollTop) { return; }
                    lastScrollTop = scrollTop;

                    // Fire off callback:
                    settings.onResize.call(this);

                    // Either animate or directly apply height:
                    settings.animate && textarea.css('display') === 'block' ?
                        toChange.stop().animate({height:scrollTop}, settings.animateDuration, settings.animateCallback)
                        : toChange.height(scrollTop);
                };

            // Bind namespaced handlers to appropriate events:
            textarea
                .unbind('.dynSiz')
                .bind('keyup.dynSiz', updateSize)
                .bind('keydown.dynSiz', updateSize)
                .bind('change.dynSiz', updateSize)
                .trigger('change.dynSiz');

        });

        // Chain:
        return this;

    };



})(jQuery);
