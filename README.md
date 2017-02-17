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

## How it Works

If you have a page opened that you would like to invest in, open the extension popup screen with your
chosen tab selected, and choose the amount you wish to invest.  

If the URL of the page has not been Amplified by anyone previously, congratulations!  
You have first-mover advantage!  Simply click on Amplify to make your investment.

If the url has already been Amplified by someone else, you will be offered the option to "Re-Amplify" the
displayed Synereo URL, which amplifies the displayed URL as opposed to the original URL itself.

In either the case, the effect of Amplifying will be to create a Synereo link URL, which you can then copy
and forward to others as you see fit.  (In the near future, the system will itself automatically forward 
the created links to other contacts in your Synereo social graph).  The generated link retains the URL
it was generated from as a "parent link" - thus forming a chain back to the original content.

If you have already (re-)Amplifield the content previously, your link will be displayed, and any investment 
you will make simply be used to increase the balance in the link.

### Views

The amount you invested in the link will be used to make payments to other Synereo users who follow the link.
The viewer of the link will get paid 1 Amp.  If link has a parent, the parent will also get paid 1 Amp, and
so on back up the chain. 

Once the balance in a link drops to zero, it will be automatically removed from the system 
(with any child links re-parented appropriately).

### Redeeming links

(NB - Not yet implemented.)

At any stage you can review all the links you currently have investments in, along with their current balances.
You can choose to "redeem" any such links, such that the balance will be transferred back into your account,
and the link removed.