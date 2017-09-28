# ReactNative源码篇：渲染原理

**关于作者**

>郭孝星，程序员，吉他手，主要从事Android平台基础架构方面的工作，欢迎交流技术方面的问题，可以去我的[Github](https://github.com/guoxiaoxing)提issue或者发邮件至guoxiaoxingse@163.com与我交流。

更多文章：https://github.com/guoxiaoxing/react-native/blob/master/README.md

>本篇系列文章主要分析ReactNative源码，分析ReactNative的启动流程、渲染原理、通信机制与线程模型等方面内容。

- [1ReactNative源码篇：源码初识](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/1ReactNative源码篇：源码初识.md)
- [2ReactNative源码篇：代码调用](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：代码调用.md)
- [3ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/3ReactNative源码篇：启动流程.md)
- [4ReactNative源码篇：渲染原理](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/4ReactNative源码篇：渲染原理.md)
- [5ReactNative源码篇：线程模型](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/5ReactNative源码篇：线程模型.md)
- [6ReactNative源码篇：通信机制](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/6ReactNative源码篇：通信机制.md)


## 一 JS的加载流程

在讲解渲染流程之前，我们先来看看JS是如何被加载的，JS的加载有很多种方式，可以从本地加载，也可以从服务器加载。

在文章[3ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/3ReactNative源码篇：启动流程.md)中，我们提到
在创建上下文的之前会去加载JS

```java
public class ReactInstanceManager {

 /**
   * Trigger react context initialization asynchronously in a background async task. This enables
   * applications to pre-load the application JS, and execute global code before
   * {@link ReactRootView} is available and measured. This should only be called the first time the
   * application is set up, which is enforced to keep developers from accidentally creating their
   * application multiple times without realizing it.
   *
   * Called from UI thread.
   */
  public void createReactContextInBackground() {
    Assertions.assertCondition(
        !mHasStartedCreatingInitialContext,
        "createReactContextInBackground should only be called when creating the react " +
            "application for the first time. When reloading JS, e.g. from a new file, explicitly" +
            "use recreateReactContextInBackground");

    mHasStartedCreatingInitialContext = true;
    //进一步调用recreateReactContextInBackgroundInner()
    recreateReactContextInBackgroundInner();
  }

  /**
   * Recreate the react application and context. This should be called if configuration has
   * changed or the developer has requested the app to be reloaded. It should only be called after
   * an initial call to createReactContextInBackground.
   *
   * Called from UI thread.
   */
  public void recreateReactContextInBackground() {
    Assertions.assertCondition(
        mHasStartedCreatingInitialContext,
        "recreateReactContextInBackground should only be called after the initial " +
            "createReactContextInBackground call.");
    recreateReactContextInBackgroundInner();
  }

  private void recreateReactContextInBackgroundInner() {
    UiThreadUtil.assertOnUiThread();

    //开发模式，实现在线更新Bundle，晃动弹出调试菜单等功能，这一部分属于调试功能流程。
    if (mUseDeveloperSupport && mJSMainModuleName != null) {
      final DeveloperSettings devSettings = mDevSupportManager.getDevSettings();

      // If remote JS debugging is enabled, load from dev server.
      //判断是否处于开发模式，如果处于开发模式，则从Dev Server中获取JSBundle，如果不是则从文件中获取。
      if (mDevSupportManager.hasUpToDateJSBundleInCache() &&
          !devSettings.isRemoteJSDebugEnabled()) {
        // If there is a up-to-date bundle downloaded from server,
        // with remote JS debugging disabled, always use that.
        onJSBundleLoadedFromServer();
      } else if (mBundleLoader == null) {
        mDevSupportManager.handleReloadJS();
      } 
      
      else {
        mDevSupportManager.isPackagerRunning(
            new PackagerStatusCallback() {
              @Override
              public void onPackagerStatusFetched(final boolean packagerIsRunning) {
                UiThreadUtil.runOnUiThread(
                    new Runnable() {
                      @Override
                      public void run() {
                        //打包服务器已经运行，开始加载JS
                        if (packagerIsRunning) {
                          mDevSupportManager.handleReloadJS();
                        } else {
                          // If dev server is down, disable the remote JS debugging.
                          devSettings.setRemoteJSDebugEnabled(false);
                          recreateReactContextInBackgroundFromBundleLoader();
                        }
                      }
                    });
              }
            });
      }
      return;
    }

    //线上模式
    recreateReactContextInBackgroundFromBundleLoader();
  }
}
```

我们重点来看看DevSupportManager.handleReloadJS()方法。

```java
public class DevSupportManagerImpl implements
    DevSupportManager,
    PackagerCommandListener,
    DevInternalSettings.Listener {

      @Override
      public void handleReloadJS() {
        UiThreadUtil.assertOnUiThread();
    
        // dismiss redbox if exists
        if (mRedBoxDialog != null) {
          mRedBoxDialog.dismiss();
        }
    
        if (mDevSettings.isRemoteJSDebugEnabled()) {
          mDevLoadingViewController.showForRemoteJSEnabled();
          mDevLoadingViewVisible = true;
          reloadJSInProxyMode();
        } else {
          String bundleURL =
            mDevServerHelper.getDevServerBundleURL(Assertions.assertNotNull(mJSAppBundleName));
          reloadJSFromServer(bundleURL);
        }
      }
}
```

这里的mJSAppBundleName是在创建ReactNativeHost里创建的，由getJSMainModuleName()方法提供，默认是index.android。

```java
  protected String getJSMainModuleName() {
    return "index.android";
  }
```
bundleURL是由mJSAppBundleName、platform、dev等拼接未来，它描述JS Bundle的位置信息以及一些开发信息。

本地Bundle

```
http://172.17.4.143:8081/index.android.bundle?platform=android&dev=true&hot=false&minify=false
```

DevSupportManagerImpl.handleReloadJS()调用reloadJSFromServer(bundleURL)来加载Bundle，reloadJSFromServer(bundleURL)
又调用BundleDownloader.()方法来加载Bundle，我们来看看这个方法的实现。

### 1.1 关键点1：BundleDownloader.downloadBundleFromURL(final DevBundleDownloadListener callback, final File outputFile, final String bundleURL) 

```java
public class BundleDownloader {

     public void downloadBundleFromURL(
          final DevBundleDownloadListener callback,
          final File outputFile,
          final String bundleURL) {
        final Request request = new Request.Builder()
            .url(bundleURL)
            // FIXME: there is a bug that makes MultipartStreamReader to never find the end of the
            // multipart message. This temporarily disables the multipart mode to work around it, but
            // it means there is no progress bar displayed in the React Native overlay anymore.
            //.addHeader("Accept", "multipart/mixed")
            .build();
        mDownloadBundleFromURLCall = Assertions.assertNotNull(mClient.newCall(request));
        mDownloadBundleFromURLCall.enqueue(new Callback() {
          @Override
          public void onFailure(Call call, IOException e) {
            // ignore callback if call was cancelled
            if (mDownloadBundleFromURLCall == null || mDownloadBundleFromURLCall.isCanceled()) {
              mDownloadBundleFromURLCall = null;
              return;
            }
            mDownloadBundleFromURLCall = null;
    
            callback.onFailure(DebugServerException.makeGeneric(
                "Could not connect to development server.",
                "URL: " + call.request().url().toString(),
                e));
          }
    
          @Override
          public void onResponse(Call call, final Response response) throws IOException {
            // ignore callback if call was cancelled
            if (mDownloadBundleFromURLCall == null || mDownloadBundleFromURLCall.isCanceled()) {
              mDownloadBundleFromURLCall = null;
              return;
            }
            mDownloadBundleFromURLCall = null;
    
            final String url = response.request().url().toString();
    
            //contentType为application/javascript
            String contentType = response.header("content-type");
            Pattern regex = Pattern.compile("multipart/mixed;.*boundary=\"([^\"]+)\"");
            Matcher match = regex.matcher(contentType);
            if (match.find()) {
              String boundary = match.group(1);
              MultipartStreamReader bodyReader = new MultipartStreamReader(response.body().source(), boundary);
              boolean completed = bodyReader.readAllParts(new MultipartStreamReader.ChunkCallback() {
                @Override
                public void execute(Map<String, String> headers, Buffer body, boolean finished) throws IOException {
                  // This will get executed for every chunk of the multipart response. The last chunk
                  // (finished = true) will be the JS bundle, the other ones will be progress events
                  // encoded as JSON.
                  if (finished) {
                    // The http status code for each separate chunk is in the X-Http-Status header.
                    int status = response.code();
                    if (headers.containsKey("X-Http-Status")) {
                      status = Integer.parseInt(headers.get("X-Http-Status"));
                    }
                    processBundleResult(url, status, body, outputFile, callback);
                  } else {
                    if (!headers.containsKey("Content-Type") || !headers.get("Content-Type").equals("application/json")) {
                      return;
                    }
                    try {
                      JSONObject progress = new JSONObject(body.readUtf8());
                      String status = null;
                      if (progress.has("status")) {
                        status = progress.getString("status");
                      }
                      Integer done = null;
                      if (progress.has("done")) {
                        done = progress.getInt("done");
                      }
                      Integer total = null;
                      if (progress.has("total")) {
                        total = progress.getInt("total");
                      }
                      callback.onProgress(status, done, total);
                    } catch (JSONException e) {
                      FLog.e(ReactConstants.TAG, "Error parsing progress JSON. " + e.toString());
                    }
                  }
                }
              });
              if (!completed) {
                callback.onFailure(new DebugServerException(
                    "Error while reading multipart response.\n\nResponse code: " + response.code() + "\n\n" +
                    "URL: " + call.request().url().toString() + "\n\n"));
              }
            } else {
              // In case the server doesn't support multipart/mixed responses, fallback to normal download.
              //如果服务器不支持multipart/mixed的responses，则利用Okio将返回内容即JS Bundle写入缓存
              processBundleResult(url, response.code(), Okio.buffer(response.body().source()), outputFile, callback);
            }
          }
        });
      }
}
```
我们先来看看这个方法的形参：

- DevBundleDownloadListener callback：下载回调
- File outputFile：Bundle缓存地址，通过new File(applicationContext.getFilesDir(), JS_BUNDLE_FILE_NAME)获取

具体位置：/data/user/0/com.guoxiaoxing.vinci.demo/files/ReactNativeDevBundle.js

- String bundleURL：Bundle地址

可以看到内部使用Okhttp来处理下载任务，不管是Local Host还是真正的Server Host都统一处理。可以看到该方法将Response里返回的数据写入本地缓存，这样JS
Bundle就算下载完成了，我们接着来看看下载完成后会继续做哪些事情。

### 1.2 关键点2：

```java
public class DevSupportManagerImpl implements
    DevSupportManager,
    PackagerCommandListener,
    DevInternalSettings.Listener {

    public void reloadJSFromServer(final String bundleURL) {
    mDevLoadingViewController.showForUrl(bundleURL);
    mDevLoadingViewVisible = true;

    mDevServerHelper.getBundleDownloader().downloadBundleFromURL(
        new DevBundleDownloadListener() {
          //Bundle下载成功
          @Override
          public void onSuccess() {
            mDevLoadingViewController.hide();
            mDevLoadingViewVisible = false;
            if (mBundleDownloadListener != null) {
              mBundleDownloadListener.onSuccess();
            }
            UiThreadUtil.runOnUiThread(
                new Runnable() {
                  @Override
                  public void run() {
                    mReactInstanceCommandsHandler.onJSBundleLoadedFromServer();
                  }
                });
          }

          @Override
          public void onProgress(@Nullable final String status, @Nullable final Integer done, @Nullable final Integer total) {
            mDevLoadingViewController.updateProgress(status, done, total);
            if (mBundleDownloadListener != null) {
              mBundleDownloadListener.onProgress(status, done, total);
            }
          }

          @Override
          public void onFailure(final Exception cause) {
            mDevLoadingViewController.hide();
            mDevLoadingViewVisible = false;
            if (mBundleDownloadListener != null) {
              mBundleDownloadListener.onFailure(cause);
            }
            FLog.e(ReactConstants.TAG, "Unable to download JS bundle", cause);
            UiThreadUtil.runOnUiThread(
                new Runnable() {
                  @Override
                  public void run() {
                    if (cause instanceof DebugServerException) {
                      DebugServerException debugServerException = (DebugServerException) cause;
                      showNewJavaError(debugServerException.getMessage(), cause);
                    } else {
                      showNewJavaError(
                          mApplicationContext.getString(R.string.catalyst_jsload_error),
                          cause);
                    }
                  }
                });
          }
        },
        mJSBundleTempFile,
        bundleURL);
  }
}      
```

我们知道DevSupportManager是在ReactInstanceManager创建时被创建的，具体如下：

```
mDevSupportManager = DevSupportManagerFactory.create(
    applicationContext,
    mDevInterface,
    mJSMainModulePath,
    useDeveloperSupport,
    redBoxHandler,
    devBundleDownloadListener,
    minNumShakes);
```
因此mBundleDownloadListener是由开发者传递进来的，用来对Bundle的下载流程做一些额外的操作，这里的mBundleDownloadListener为空。mReactInstanceCommandsHandler
在ReactInstanceManager内部创建，它调用的其实是ReactInstanceManager里的内部方法，如下：

```java
private final ReactInstanceDevCommandsHandler mDevInterface =
    new ReactInstanceDevCommandsHandler() {

      @Override
      public void onReloadWithJSDebugger(JavaJSExecutor.Factory jsExecutorFactory) {
        ReactInstanceManager.this.onReloadWithJSDebugger(jsExecutorFactory);
      }

      @Override
      public void onJSBundleLoadedFromServer() {
        ReactInstanceManager.this.onJSBundleLoadedFromServer();
      }

      @Override
      public void toggleElementInspector() {
        ReactInstanceManager.this.toggleElementInspector();
      }
    };
```
mReactInstanceCommandsHandler.onJSBundleLoadedFromServer()最终走到了JSBundleLoader createCachedBundleFromNetworkLoader()这个方法里，它用来创建
对应的Bundle Loader来加载对应的Bundle。

JSBundleLoader createCachedBundleFromNetworkLoader()又调用CatalystInstanceImpl里的方法来完成加载，当然最终的加载在C++层里完成。

```java
public class CatalystInstanceImpl implements CatalystInstance {

 /* package */ void setSourceURLs(String deviceURL, String remoteURL) {
    mSourceURL = deviceURL;
    jniSetSourceURL(remoteURL);
  }

  /* package */ void loadScriptFromAssets(AssetManager assetManager, String assetURL, boolean loadSynchronously) {
    mSourceURL = assetURL;
    jniLoadScriptFromAssets(assetManager, assetURL, loadSynchronously);
  }

  /* package */ void loadScriptFromFile(String fileName, String sourceURL, boolean loadSynchronously) {
    mSourceURL = sourceURL;
    jniLoadScriptFromFile(fileName, sourceURL, loadSynchronously);
  }

  //从URL里加载
  private native void jniSetSourceURL(String sourceURL);
  //从Asset里加载
  private native void jniLoadScriptFromAssets(AssetManager assetManager, String assetURL, boolean loadSynchronously);
  //从文件里加载
  private native void jniLoadScriptFromFile(String fileName, String sourceURL, boolean loadSynchronously);
}
```
总共说来，分为三种加载方式：

- 从URL里加载
- 从Asset里加载
- 从文件里加载

## 二 JS的渲染流程

在讲解渲染原理之前，我们先来看一个简单的例子。

```javascript
import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View
} from 'react-native';

export default class android_container extends Component {
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          Welcome to React Native!
        </Text>
        <Text style={styles.instructions}>
          To get started, edit index.ios.js
        </Text>
        <Text style={styles.instructions}>
          Press Cmd+R to reload,{'\n'}
          Cmd+D or shake for dev menu
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

AppRegistry.registerComponent('android_container', () => android_container);
```

我们接触到的React Native代码通常都是JSX代码，JSX其实是一种语法糖，实际运行的时候，它还是会转换为真正的js代码，为了方便我们理解原理，我们先把上述
代码转换为js代码。

注：转换可以通过[babel](https://babeljs.io/repl/).

```javascript
  ...
  _createClass(android_container, [{
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        _reactNative.View,
        { style: styles.container },
        _react2.default.createElement(
          _reactNative.Text,
          { style: styles.welcome },
          'Welcome to React Native!'
        ),
        _react2.default.createElement(
          _reactNative.Text,
          { style: styles.instructions },
          'To get started, edit index.ios.js'
        ),
        _react2.default.createElement(
          _reactNative.Text,
          { style: styles.instructions },
          'Press Cmd+R to reload,',
          '\n',
          'Cmd+D or shake for dev menu'
        )
      );
    }
  }]);
  return android_container;
}(_react.Component);

exports.default = android_container;
 ...
_reactNative.AppRegistry.registerComponent('android_container', function () {
  return android_container;
});
```

我们可以看到原来的JSX组件都会被转换为ReactElement组件，该组件定义在ReactElement.js文件中，用来描述js上的ui组件，它里面存放了props等信息。

React Native渲染序列图如下所示：

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/4/render_sequence.png"/>

我们先来简单概括一下整个渲染流程：

1. React Native将代码由JSX转化为JS组件，启动过程中利用instantiateReactComponent将ReactElement转化为复合组件ReactCompositeComponent与元组件ReactNativeBaseComponent，利用
ReactReconciler对他们进行渲染。
2. UIManager.js利用C++层的Instance.cpp将UI信息传递给UIManagerModule.java，并利用UIManagerModule.java构建UI。
3. UIManagerModule.java接收到UI信息后，将UI的操作封装成对应的Action，放在队列中等待执行。各种UI的操作，例如创建、销毁、更新等便在队列里完成，UI最终
得以渲染在屏幕上。

如上图所示AppRegistry.registerComponent用来注册组件，在该方法内它会调用AppRegistry.runApplication()来启动js的渲染流程。AppRegistry.runApplication()
会将传入的Component转换成ReactElement，并在外面包裹一层AppContaniner，AppContaniner主要用来提供一些debug工具（例如：红盒）。

如下所示：

```javascript
function renderApplication<Props: Object>(
  RootComponent: ReactClass<Props>,
  initialProps: Props,
  rootTag: any
) {
  invariant(
    rootTag,
    'Expect to have a valid rootTag, instead got ', rootTag
  );
  ReactNative.render(
    <AppContainer rootTag={rootTag}>
      <RootComponent
        {...initialProps}
        rootTag={rootTag}
      />
    </AppContainer>,
    rootTag
  );
}
```

我们抛开函数调用链，分析其中关键的部分，其他部分都是简单的函数调用。

### 关键点1：ReactNativeMount.renderComponent()

```javascript
  /**
   * @param {ReactComponent} instance Instance to render.
   * @param {containerTag} containerView Handle to native view tag
   */
  renderComponent: function(
    nextElement: ReactElement<*>,
    containerTag: number,
    callback?: ?(() => void)
  ): ?ReactComponent<any, any, any> {
  
    //将RectElement使用相同的TopLevelWrapper进行包裹
    var nextWrappedElement = React.createElement(
      TopLevelWrapper,
      { child: nextElement }
    );

    var topRootNodeID = containerTag;
    var prevComponent = ReactNativeMount._instancesByContainerID[topRootNodeID];
    if (prevComponent) {
      var prevWrappedElement = prevComponent._currentElement;
      var prevElement = prevWrappedElement.props.child;
      if (shouldUpdateReactComponent(prevElement, nextElement)) {
        ReactUpdateQueue.enqueueElementInternal(prevComponent, nextWrappedElement, emptyObject);
        if (callback) {
          ReactUpdateQueue.enqueueCallbackInternal(prevComponent, callback);
        }
        return prevComponent;
      } else {
        ReactNativeMount.unmountComponentAtNode(containerTag);
      }
    }

    if (!ReactNativeTagHandles.reactTagIsNativeTopRootID(containerTag)) {
      console.error('You cannot render into anything but a top root');
      return null;
    }

    ReactNativeTagHandles.assertRootTag(containerTag);

    //检查之前的节点是否已经mount到目标节点上，如果有则进行比较处理
    var instance = instantiateReactComponent(nextWrappedElement, false);
    ReactNativeMount._instancesByContainerID[containerTag] = instance;

    // The initial render is synchronous but any updates that happen during
    // rendering, in componentWillMount or componentDidMount, will be batched
    // according to the current batching strategy.

    //将mount任务提交给回调Queue，最终会调用ReactReconciler.mountComponent()
    ReactUpdates.batchedUpdates(
      batchedMountComponentIntoNode,
      instance,
      containerTag
    );
    var component = instance.getPublicInstance();
    if (callback) {
      callback.call(component);
    }
    return component;
  },
```
该方法主要做了以下事情：

1. 将传入的RectElement使用相同的TopLevelWrapper进行包裹，生成nextWrappedElement。
2. 检查之前的节点是否已经mount到目标节点上，如果有则进行比较处理，将上一步生成的nextWrappedElement传入instantiateReactComponent(nextWrappedElement, false)方法。
3. 将mount任务提交给回调Queue，最终会调用ReactReconciler.mountComponent()，ReactReconciler.mountComponent()又会去调用C++层Instance::mountComponent()
方法。

### 关键点2：instantiateReactComponent.instantiateReactComponent(node, shouldHaveDebugID)

在分析这个函数之前，我们先来补充一下React组件相关知识。React组件可以分为两种：

- 元组件：框架内置的，可以直接使用的组件。例如：View、Image等。它在React Native中用ReactNativeBaseComponent来描述。
- 复合组件：用户封装的组件，一般可以通过React.createClass()来构建，提供render()方法来返回渲染目标。它在React Native中用ReactCompositeComponent来描述。

instantiateReactComponent(node, shouldHaveDebugID)方法根据对象的type生成元组件或者复合组件。

```javascript
/**
 * Given a ReactNode, create an instance that will actually be mounted.
 *
 * @param {ReactNode} node
 * @param {boolean} shouldHaveDebugID
 * @return {object} A new instance of the element's constructor.
 * @protected
 */
function instantiateReactComponent(node, shouldHaveDebugID) {
  var instance;

  if (node === null || node === false) {
    instance = ReactEmptyComponent.create(instantiateReactComponent);
  } else if (typeof node === 'object') {
    var element = node;
    var type = element.type;

    if (typeof type !== 'function' && typeof type !== 'string') {
      var info = '';
      if (process.env.NODE_ENV !== 'production') {
        if (type === undefined || typeof type === 'object' && type !== null && Object.keys(type).length === 0) {
          info += ' You likely forgot to export your component from the file ' + 'it\'s defined in.';
        }
      }
      info += getDeclarationErrorAddendum(element._owner);
      !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s', type == null ? type : typeof type, info) : _prodInvariant('130', type == null ? type : typeof type, info) : void 0;
    }

    //如果对象的type为string，则调用ReactHostComponent.createInternalComponent(element)来注入生成组件的逻辑
    if (typeof element.type === 'string') {
      instance = ReactHostComponent.createInternalComponent(element);
    }
    //如果是内部元组件，则创建一个type实例
    else if (isInternalComponentType(element.type)) {
      // This is temporarily available for custom components that are not string
      // representations. I.e. ART. Once those are updated to use the string
      // representation, we can drop this code path.
      instance = new element.type(element);

      // We renamed this. Allow the old name for compat. :(
      if (!instance.getHostNode) {
        instance.getHostNode = instance.getNativeNode;
      }
    } 
    //否则，则是用户创建的复合组件，这个时候创建一个ReactCompositeComponentWrapper实例，该实例用来描述复合组件
    else {
      instance = new ReactCompositeComponentWrapper(element);
    }
    //当对象为string或者number时，调用ReactHostComponent.createInstanceForText(node)来注入组件生成逻辑。
  } else if (typeof node === 'string' || typeof node === 'number') {
    instance = ReactHostComponent.createInstanceForText(node);
  } else {
    !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Encountered invalid React node of type %s', typeof node) : _prodInvariant('131', typeof node) : void 0;
  }

  if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV !== 'production' ? warning(typeof instance.mountComponent === 'function' && typeof instance.receiveComponent === 'function' && typeof instance.getHostNode === 'function' && typeof instance.unmountComponent === 'function', 'Only React Components can be mounted.') : void 0;
  }

  // These two fields are used by the DOM and ART diffing algorithms
  // respectively. Instead of using expandos on components, we should be
  // storing the state needed by the diffing algorithms elsewhere.
  instance._mountIndex = 0;
  instance._mountImage = null;

  if (process.env.NODE_ENV !== 'production') {
    instance._debugID = shouldHaveDebugID ? getNextDebugID() : 0;
  }

  // Internal instances should fully constructed at this point, so they should
  // not get any new fields added to them at this point.
  if (process.env.NODE_ENV !== 'production') {
    if (Object.preventExtensions) {
      Object.preventExtensions(instance);
    }
  }

  return instance;
}
```

该方法根据对象的type生成元组件或者复合组件，具体流程如下：

1. 如果对象的type为string，则调用ReactHostComponent.createInternalComponent(element)来注入生成组件的逻辑，如果是内部元组件，则创建一个type实例，
否则，则是用户创建的复合组件，这个时候创建一个ReactCompositeComponentWrapper实例，该实例用来描述复合组件。
2. 当对象为string或者number时，调用ReactHostComponent.createInstanceForText(node)来注入组件生成逻辑。
3. 以上都不是，则报错。

我们通过前面的分析，了解了整个UI开始渲染的时机，以及js层的整个渲染流程，接下来，我们开始分析每个js的组件时怎么转换成Android的组件，最终显示在屏幕上的。

上面我们提到元组件与复合组件，事实上复合组件也是递归遍历其中的元组件，然后进行渲染。所以我们重点关注元组件的生成逻辑。

元组件的渲染流程图如下所示：

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/4/react_native_render_principle_flow.png"/>

我们可以看到，UI渲染主要通过UIManager来完成，UIManager是一个ReactModule，UIManager.js里的操作都会对应到UIManagerModule里来。

### 关键点3：UIManagerModule.createView

在UIManagerModule这个类里被@ReactMethod注解标记的都是可以被js调用的方法。UIManagerModule把功能委托给了UIImplementation来实现。


```java
public class UIImplementation {

  /**
   * Invoked by React to create a new node with a given tag, class name and properties.
   */
  public void createView(int tag, String className, int rootViewTag, ReadableMap props) {
    ReactShadowNode cssNode = createShadowNode(className);
    ReactShadowNode rootNode = mShadowNodeRegistry.getNode(rootViewTag);
    cssNode.setReactTag(tag);
    cssNode.setViewClassName(className);
    cssNode.setRootNode(rootNode);
    cssNode.setThemedContext(rootNode.getThemedContext());

    mShadowNodeRegistry.addNode(cssNode);

    ReactStylesDiffMap styles = null;
    if (props != null) {
      styles = new ReactStylesDiffMap(props);
      cssNode.updateProperties(styles);
    }

    handleCreateView(cssNode, rootViewTag, styles);
  }
  
    protected void handleCreateView(
        ReactShadowNode cssNode,
        int rootViewTag,
        @Nullable ReactStylesDiffMap styles) {
      if (!cssNode.isVirtual()) {
        mNativeViewHierarchyOptimizer.handleCreateView(cssNode, cssNode.getThemedContext(), styles);
      }
    }
}
```

ReactShadowNode用来描述DOM树的节点，它将js层传递过来的UI信息包装成一个ReactShadowNode，调用handleCreateView()方法把UI的操作封装成一个
Action，放进队列中等到执行。

### 关键点4：NativeViewHierarchyManager.createView()

从上面的序列可以看出，所有的View操作都会被被包装成一个Action，然后放在队列中等待处理。

```java
public class NativeViewHierarchyManager {

    public void createView(
          ThemedReactContext themedContext,
          int tag,
          String className,
          @Nullable ReactStylesDiffMap initialProps) {
        UiThreadUtil.assertOnUiThread();
        SystraceMessage.beginSection(
            Systrace.TRACE_TAG_REACT_VIEW,
            "NativeViewHierarchyManager_createView")
            .arg("tag", tag)
            .arg("className", className)
            .flush();
        try {
          ViewManager viewManager = mViewManagers.get(className);
    
          View view = viewManager.createView(themedContext, mJSResponderHandler);
          mTagsToViews.put(tag, view);
          mTagsToViewManagers.put(tag, viewManager);
    
          // Use android View id field to store React tag. This is possible since we don't inflate
          // React views from layout xmls. Thus it is easier to just reuse that field instead of
          // creating another (potentially much more expensive) mapping from view to React tag
          view.setId(tag);
          if (initialProps != null) {
            viewManager.updateProperties(view, initialProps);
          }
        } finally {
          Systrace.endSection(Systrace.TRACE_TAG_REACT_VIEW);
        }
      }
}
```

可以看到该函数调用ViewManager.createView()来创建了View。

```java
@ReactPropertyHolder
public abstract class ViewManager<T extends View, C extends ReactShadowNode>
  extends BaseJavaModule {

     public final T createView(
         ThemedReactContext reactContext,
         JSResponderHandler jsResponderHandler) {
       T view = createViewInstance(reactContext);
       addEventEmitters(reactContext, view);
       if (view instanceof ReactInterceptingViewGroup) {
         ((ReactInterceptingViewGroup) view).setOnInterceptTouchEventListener(jsResponderHandler);
       }
       return view;
     }
}
```
ViewManager.createView()方法调用相应组件的构造函数构建View实例，并设置事件发射器，当前View发生的事件会通过发射器发送到JS层处理。


以上便是React Native渲染的整个流程，我们再来总结一下。

1. React Native将代码由JSX转化为JS组件，启动过程中利用instantiateReactComponent将ReactElement转化为复合组件ReactCompositeComponent与元组件ReactNativeBaseComponent，利用
ReactReconciler对他们进行渲染。
2. UIManager.js利用C++层的Instance.cpp将UI信息传递给UIManagerModule.java，并利用UIManagerModule.java构建UI。
3. UIManagerModule.java接收到UI信息后，将UI的操作封装成对应的Action，放在队列中等待执行。各种UI的操作，例如创建、销毁、更新等便在队列里完成，UI最终
得以渲染在屏幕上。

