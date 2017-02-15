# Amplitude

An experimental prototype for Synereo attention economy development.

The backend (server) uses Typescript, NodeJS and PostgreSQL.

The project supports (assumes?) the use of the excellent (and free) Visual Studio Code development tool,
and includes configuration files for that tool.

## Testing current prototype

To experiment, visit: [Synereo Test Prototype](https://synereo-amplitude.herokuapp.com).

There you will be able download the plugin, and instructions are provided as to installing and running it.

## Build Dependencies

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/en/)

## Runtime Dependencies

* [PostgreSQL](https://www.postgresql.org/)
* [Google Chrome](https://www.google.com/chrome/index.html)

## Installation

First, build the extension files:

```sh
$ git clone https://github.com/synereo/amplitude.git
$ cd amplitude
$ npm install
$ npm run build
```

## Capuchin - Chrome Extension

The extension files will be generated into the `dist/capuchin` directory.  

To install:
* Open Chrome.
* Navigate to `chrome://extensions`.
* Enable **Developer mode** by clicking the checkbox in the upper-right hand corner.
* Click the **Load unpacked extension...** button.
* Navigate to the newly-created `dist/capuchin` directory and click **Select**.

For more information, see:

https://developer.chrome.com/extensions/getstarted#unpacked

## Usage

TODO:  Information on installing and running server (backend).  Heroku instructions too maybe?