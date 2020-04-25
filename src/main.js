require('fix-path')(); // Fix $PATH on darwin
require( 'v8-compile-cache' );
const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require( 'electron' );

const oslocale = require( 'os-locale' ),
   fs = require( 'fs-extra' ),
  ini = require( 'ini' );

const UIText = require( './FSOLauncher_UI/UIText.json' ),
 FSOLauncher = require( './FSOLauncher/FSOLauncher' ),
     package = require( './package.json' );

         process.title = 'FreeSO Launcher';
        global.VERSION = package.version;
     global.WEBSERVICE = '173.212.246.204';
global.SOCKET_ENDPOINT = '30001';
global.REMESH_ENDPOINT = 'RemeshPackage';
global.UPDATE_ENDPOINT = 'UpdateCheck';
        global.HOMEDIR = require("os").homedir();
       global.willQuit = false;
/**
 * On Windows, prefs and temps are written straight to the launcher folder.
 * On Mac, they are written in ~/Library/Application Support/fsolauncher.
 */
global.APPDATA = process.platform == 'darwin' ? 
  `${global.HOMEDIR}/Library/Application Support/fsolauncher/` : '';
if(process.platform == 'darwin') fs.ensureDirSync(global.APPDATA + 'temp');

let Window, tray, launcher, trayIcon, conf;

const code = oslocale.sync().substring( 0, 2 ), 
   options = {};

global.locale = Object.prototype.hasOwnProperty.call( UIText, code )
  ? UIText[code]
  : UIText['en'];
global.locale.LVERSION = global.VERSION;
global.locale.PLATFORM = process.platform;

require( 'electron-pug' )( { pretty: false }, global.locale );

try {
  conf = ini.parse( fs.readFileSync( global.APPDATA + 'FSOLauncher.ini', 'utf-8' ) );
} catch ( e ) {
  conf = {
    Launcher: {
      Theme: 'open_beta',
      DesktopNotifications: '1',
      Persistence: '1',
      DirectLaunch: '0'
    },
    Game: {
      GraphicsMode: 'ogl',
      Language: 'en',
      TTS: '0'
    }
  };

  fs.writeFileSync( global.APPDATA + 'FSOLauncher.ini', ini.stringify( conf ), 'utf-8' );
}

function CreateWindow() {
  trayIcon = nativeImage.createFromPath(
    require('path').join(__dirname, process.platform == 'darwin' ? 'beta.png' : 'beta.ico')
  );
  if(process.platform == 'darwin') {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }
  tray = new Tray( trayIcon );

  const width = 1100, height = 665;

  options.minWidth = width;
  options.minHeight = height;
  options.maxWidth = width;
  options.maxHeight = height;
  options.center = true;
  options.maximizable = false;
  options.width = width;
  options.height = height;
  options.useContentSize = true;
  options.show = false;
  options.resizable = false;
  options.title = 'FreeSO Launcher ' + global.VERSION;
  options.icon = process.platform == 'darwin' ? 'beta.icns' : 'beta.ico';
  options.webPreferences = {
    nodeIntegration: true
  }; // Since we're not displaying untrusted content
  // (all links are opened in a real browser window), we can enable this.

  Window = new BrowserWindow( options );

  Window.setMenu( null );
  //Window.openDevTools({ mode: 'detach' });
  Window.loadURL( `file://${__dirname}/FSOLauncher_UI/FSOLauncher.pug` );

  launcher = new FSOLauncher( Window, conf );

  tray.setToolTip( `FreeSO Launcher ${global.VERSION}` );
  tray.setContextMenu( Menu.buildFromTemplate( [
    {
      label: global.locale.TRAY_LABEL_1,
      click: () => {
        launcher.onPlay();
      }
    },
    {
      type: 'separator'
    },
    {
      label: global.locale.TRAY_LABEL_2,
      click: () => {
        global.willQuit = true;
        Window.close();
      }
    }
  ] ) );

  tray.on( 'click', () => {
    Window.isVisible() ? Window.hide() : Window.show();
  } );

  Window.on( 'closed', () => { Window = null; } );

  Window.once( 'ready-to-show', () => {
    launcher
      .updateInstalledPrograms()
      .then( () => {
        if ( conf.Launcher.DirectLaunch === '1' && launcher.isInstalled.FSO ) {
          launcher.onPlay();
          if(process.platform == 'darwin') {
            Window.show();
          }
        } else {
          Window.show();
        }
      } )
      .catch( _err => {
        Window.show();
      } );
  } );

  Window.on( 'close', e => {
    if ( !global.willQuit && launcher.conf.Launcher.Persistence === '1' ) {
      e.preventDefault();
      Window.minimize();
    }
  } );

  Window.webContents.on( 'new-window', ( e, url ) => {
    e.preventDefault();
    shell.openExternal( url );
  } );
}

app.on( 'ready', CreateWindow );

app.on( 'before-quit', function() {
  tray.destroy();
} );

app.on( 'window-all-closed', () => {
  app.quit();
} );

app.on( 'activate', () => {
  null === Window && CreateWindow();
} );

const gotTheLock = app.requestSingleInstanceLock();

if ( !gotTheLock ) {
  app.quit();
} else {
  app.on( 'second-instance', ( _event, _commandLine, _workingDirectory ) => {
    if ( Window ) {
      Window.show();
      Window.focus();
    }
  } );
}