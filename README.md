# Code - A JavaScript Tutorial Site

This Pageforest.com application allows authors to create their JavaScript lesson pages.  A lesson
page is a document that contains embedded challenges.

Users can then read the lessons and solve the challenges.

To see this code in action, visit [code.pageforest.com].

## Authoring Lessons

A lesson is merely a [Markdown] document with two extension tags:

*Script* tags (`<script>...</script>`) can be used to created *live* embeded code samples.  By using the write() function
in a code sample, a small console window will be appended to the code sample to show it's output.

*Challenge* tags can be used to insert coding challenges in a lesson.  A Challenge consists of these parts:

- **Code** - Some sample code you want the reader to modify.
- **Code context** - You can provide *prefix* and *suffix* sections of code that will wrap the readers's code block
  before it is executed.
- **Test** - You can write unit-testing code to verify the correctness of a reader's code solution.  Tests are
  written using [QUnit].


  [Markdown]: http://daringfireball.net/projects/markdown/
  [code.pageforest.com]: http://code.pageforest.com
  [QUnit]: http://docs.jquery.com/Qunit