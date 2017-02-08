# Amplitude

An experimental prototype backend for Synereo attention economy development.

Uses Typescript, NodeJS and PostgreSQL.


![](doc/grinder.jpg)

capuchin
========

An experimental Chrome Extension.

## Build Dependencies

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/en/)

## Runtime Dependencies

* [Google Chrome](https://www.google.com/chrome/index.html)

## Installation

First, build the extension files:

```sh
$ git clone https://github.com/synereo/capuchin.git
$ cd capuchin
$ npm install
$ npm run webpack
```

The extension files will be generated in the `dist` directory.  

To install:
* Open Chrome.
* Navigate to `chrome://extensions`.
* Enable **Developer mode** by clicking the checkbox in the upper-right hand corner.
* Click the **Load unpacked extension...** button.
* Navigate to the newly-created `dist` directory and click **Select**.

For more information, see:

https://developer.chrome.com/extensions/getstarted#unpacked

## Usage

In order to use the extension, an instance of [ziggurat](https://github.com/synereo/ziggurat) must be running and available at [http://localhost:8080](http://localhost:8080).
