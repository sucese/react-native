# ReactNative源码篇：启动流程

作者: 郭孝星  
邮箱: guoxiaoxingse@163.com  
博客: http://blog.csdn.net/allenwells   
简书: http://www.jianshu.com/users/66a47e04215b/latest_articles  

**关于作者**

>郭孝星，非著名程序员，代码洁癖患者，爱编程，好吉他，喜烹饪，爱一切有趣的事物和人。

**关于文章**

>作者的文章会同时发布在Github、CSDN与简书上, 文章顶部也会附上文章的Github链接。如果文章中有什么疑问也欢迎发邮件与我交流, 对于交流
的问题, 请描述清楚问题并附上代码与日志, 一般都会给予回复。如果文章中有什么错误, 也欢迎斧正。如果你觉得本文章对你有所帮助, 也欢迎去
star文章, 关注文章的最新的动态。另外建议大家去Github上浏览文章，一方面文章的写作都是在Github上进行的，所以Github上的更新是最及时
的，另一方面感觉Github对Markdown的支持更好，文章的渲染也更加美观。

文章目录：https://github.com/guoxiaoxing/react-native-android-container/blob/master/README.md

在分析具体的启动流程之前，我们先从Demo代码入手，对外部的代码有个大致的印象，我们才能进一步去了解内部的逻辑。

1 首先我们会在应用的Application里做RN的初始化操作。

```java
  //ReactNativeHost：持有ReactInstanceManager实例，做一些初始化操作。
  private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
    @Override
    public boolean getUseDeveloperSupport() {
      return BuildConfig.DEBUG;
    }

    @Override
    protected List<ReactPackage> getPackages() {
      return Arrays.<ReactPackage>asList(
          new MainReactPackage()
      );
    }
  };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    //SoLoader：加载C++底层库，准备解析JS。
    SoLoader.init(this, /* native exopackage */ false);
  }
}

```

2 页面继承ReactActivity，ReactActivity作为JS页面的容器。


```java
public class MainActivity extends ReactActivity {

    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        //返回组件名
        return "standard_project";
    }
}
```

3 有了ReactActivity作为容器，我们就可以用JS开发页面了。

```javascript
import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View
} from 'react-native';

//Component用来做UI渲染，生命周期控制，事件分发与回调。
export default class standard_project extends Component {
  //render函数返回UI的界面结构（JSX编写，编译完成后最终会变成JS代码）
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          Welcome to React Native!
        </Text>
        <Text style={styles.instructions}>
          To get started, edit index.android.js
        </Text>
        <Text style={styles.instructions}> 
          Double tap R on your keyboard to reload,{'\n'}
          Shake or press menu button for dev menu
        </Text>
      </View>
    );
  }
}

//创建CSS样式
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

//注册组件名，JS与Java格子各自维护了一个注册表
AppRegistry.registerComponent('standard_project', () => standard_project);
```
以上便是RN开发的三个步骤，本篇文章我们重点关注RN应用的启动流程，具体说来，有以下几个方面：

```
1 RN应用的启动调用流程，各组件完成的功能。
```

## 关键概念

整个启动流程重要创建实例之一就是ReactContext，在正式介绍启动流程之前，我们先来了接一下ReactContext的概念。

>ReactContext继承于ContextWrapper，也就是说它和Android中的Context是一个概念，是整个应用的上下文。那么什么是上下文呢，我们知道Android的应用模型是基于组件的应用设计模式，
组件的运行需要完整的运行环境，这种运行环境便是应用的上下文。

上面的概念可能有点抽象，我们举个例子说明一下。

用户与操作系统的每一次交互都是一个场景，例如：打电话、发短信等有节目的场景（Activity），后台播放音乐等没有节目的场景（Service），这种交互的场景（Activity、Service等）都被
抽象成了上下文环境（Context），它代表了当前对象再应用中所处的一个环境、一个与系统交互的过程。


我们来了解一下ReactContext的具体实现与功能，先来看一下它的类图：

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/2/UMLClassDiagram-bridge-ReactContext.png"/>

从上图可以看出，ReactContext继承与ContextWrapper，并有子类：

```
ReactApplicationContext：继承于ReactContext，ReactContext的wrapper类，就像Context与ContextWrapper的关系一样。
ThemedReactContext：继承于ReactContext，也是ReactContext的wrapper类。
```

## 启动流程

好，我们先从ReactActivity入手。😌

ReactActivity继承于Activity，并实现了它的生命周期方法。ReactActivity自己并没有做什么事情，所有的功能都由它的委托类ReactActivityDelegate来完成。

如下所示：

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/4/ClusterCallButterfly-react-ReactActivity.png"/>

所以我们主要来关注ReactActivityDelegate的实现。我们先来看看ReactActivityDelegate的onCreate()方法。

```java
public class ReactActivityDelegate {

  protected void onCreate(Bundle savedInstanceState) {
    boolean needsOverlayPermission = false;
    //开发模式判断以及权限检查
    if (getReactNativeHost().getUseDeveloperSupport() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      // Get permission to show redbox in dev builds.
      if (!Settings.canDrawOverlays(getContext())) {
        needsOverlayPermission = true;
        Intent serviceIntent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        FLog.w(ReactConstants.TAG, REDBOX_PERMISSION_MESSAGE);
        Toast.makeText(getContext(), REDBOX_PERMISSION_MESSAGE, Toast.LENGTH_LONG).show();
        ((Activity) getContext()).startActivityForResult(serviceIntent, REQUEST_OVERLAY_PERMISSION_CODE);
      }
    }

    //mMainComponentName就是上面ReactActivity.getMainComponentName()返回的组件名
    if (mMainComponentName != null && !needsOverlayPermission) {
        //载入app页面
      loadApp(mMainComponentName);
    }
    mDoubleTapReloadRecognizer = new DoubleTapReloadRecognizer();
  }

  protected void loadApp(String appKey) {
    if (mReactRootView != null) {
      throw new IllegalStateException("Cannot loadApp while app is already running.");
    }
    //创建ReactRootView作为根视图,它本质上是一个FrameLayout
    mReactRootView = createRootView();
    //启动RN应用
    mReactRootView.startReactApplication(
      getReactNativeHost().getReactInstanceManager(),
      appKey,
      getLaunchOptions());
    //Activity的setContentView()方法  
    getPlainActivity().setContentView(mReactRootView);
  }
}
```

可以发现ReactActivityDelegate在创建时主要做了以下事情：

```
1 创建ReactRootView作为应用的容器，它本质上是一个FrameLayout。
2 调用ReactRootView.startReactApplication()进一步执行应用启动流程。
3 调用Activity.setContentView()将创建的ReactRootView作为ReactActivity的content view。
```

尅看出RN真正核心的地方就在于ReactRootView，它就是一个View，你可以像用其他UI组件那样把它用在Android应用的任何地方。好，我们进一步去ReactRootView看启动流程。


```java
public class ReactRootView extends SizeMonitoringFrameLayout implements RootView {

  /**
   * Schedule rendering of the react component rendered by the JS application from the given JS
   * module (@{param moduleName}) using provided {@param reactInstanceManager} to attach to the
   * JS context of that manager. Extra parameter {@param launchOptions} can be used to pass initial
   * properties for the react component.
   */
  public void startReactApplication(
      ReactInstanceManager reactInstanceManager,
      String moduleName,
      @Nullable Bundle launchOptions) {
    UiThreadUtil.assertOnUiThread();

    // TODO(6788889): Use POJO instead of bundle here, apparently we can't just use WritableMap
    // here as it may be deallocated in native after passing via JNI bridge, but we want to reuse
    // it in the case of re-creating the catalyst instance
    Assertions.assertCondition(
        mReactInstanceManager == null,
        "This root view has already been attached to a catalyst instance manager");

    mReactInstanceManager = reactInstanceManager;
    mJSModuleName = moduleName;
    mLaunchOptions = launchOptions;

    //创建RN应用上下文
    if (!mReactInstanceManager.hasStartedCreatingInitialContext()) {
      mReactInstanceManager.createReactContextInBackground();
    }

    // We need to wait for the initial onMeasure, if this view has not yet been measured, we set which
    // will make this view startReactApplication itself to instance manager once onMeasure is called.
    if (mWasMeasured) {
      attachToReactInstanceManager();
    }
  }

}
```

我们来看看这个函数的3个参数：

···
ReactInstanceManager reactInstanceManager：管理React实例。
String moduleName：模块的名字，对应ReactActivity.getMainComponentName()与AppRegistry.registerComponent()。
Bundle launchOptions：Bundle类型的数据，如果我们不继承ReactActivity而是自己实现页面容器，可以通过这个参数在startActivity()时传递参数到JS层。
···

我们可以看到，ReactRootView.startReactApplication()方法里最终会调用ReactInstanceManager.createReactContextInBackground()来创建RN应用的上下文。

### ReactInstanceManager.createReactContextInBackground()

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
      } else {
        mDevSupportManager.isPackagerRunning(
            new PackagerStatusCallback() {
              @Override
              public void onPackagerStatusFetched(final boolean packagerIsRunning) {
                UiThreadUtil.runOnUiThread(
                    new Runnable() {
                      @Override
                      public void run() {
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

  private void recreateReactContextInBackgroundFromBundleLoader() {
    recreateReactContextInBackground(
        new JSCJavaScriptExecutor.Factory(mJSCConfig.getConfigMap()),
        mBundleLoader);
  }

  private void recreateReactContextInBackground(
      JavaScriptExecutor.Factory jsExecutorFactory,
      JSBundleLoader jsBundleLoader) {
    UiThreadUtil.assertOnUiThread();

    ReactContextInitParams initParams =
        new ReactContextInitParams(jsExecutorFactory, jsBundleLoader);
    if (mReactContextInitAsyncTask == null) {
      //初始化一个异步任务，创建ReactApplicationContext
      // No background task to create react context is currently running, create and execute one.
      mReactContextInitAsyncTask = new ReactContextInitAsyncTask();
      mReactContextInitAsyncTask.executeOnExecutor(AsyncTask.THREAD_POOL_EXECUTOR, initParams);
    } else {
      // Background task is currently running, queue up most recent init params to recreate context
      // once task completes.
      mPendingReactContextInitParams = initParams;
    }
  }

}
```


整个代码的调用链，最终开启异步任务ReactContextInitAsyncTask来创建上下文ReactApplicationContext。

ReactInstanceManager.createReactContextInBackground()
->ReactInstanceManager.recreateReactContextInBackground()
->ReactInstanceManager.recreateReactContextInBackgroundInner()
->ReactInstanceManager.recreateReactContextInBackgroundFromBundleLoader()
->ReactInstanceManager.recreateReactContextInBackground(JavaScriptExecutor.Factory jsExecutorFactory, JSBundleLoader jsBundleLoader)
->ReactContextInitAsyncTask


最终会调用ReactInstanceManager.recreateReactContextInBackgroundInner()来执行ReactApplicationContext的创建，整个创建
过程是异步的，这使得我们在页面真正加载之前可以去执行一些其他的初始化操作。我们来具体看看ReactInstanceManager.recreateReactContextInBackgroundInner()做了哪些事情：

```
1 判断是否处于开发模式，如果处于开发模式则从Deve Server获取JSBundle，否则则从文件中获取。
```
### ReactInstanceManager.onJSBundleLoadedFromServer() 

我们先来看看从Dev Server获取JSBundle的情况。

```java
public class ReactInstanceManager {
    
  private void onJSBundleLoadedFromServer() {
    recreateReactContextInBackground(
        new JSCJavaScriptExecutor.Factory(mJSCConfig.getConfigMap()),
        JSBundleLoader.createCachedBundleFromNetworkLoader(
            mDevSupportManager.getSourceUrl(),
            mDevSupportManager.getDownloadedJSBundleFile()));
  }

}
```

JSBundleLoader.createCachedBundleFromNetworkLoader()创建JSBundleLoader，在JSBundleLoader这个类里还有很多其他方法，比如如果不是开发模式，则会调用
JSBundleLoader.createFileLoader()，它会从文件中加载JSBundle。我们再来看看recreateReactContextInBackground()的实现。

### ReactInstanceManager.recreateReactContextInBackground()

```

该方法启动了一个ReactContextInitAsyncTask的异步任务去执行的创建。

### ReactInstanceManager.ReactContextInitAsyncTask

```java
public class ReactInstanceManager {

 /*
   * Task class responsible for (re)creating react context in the background. These tasks can only
   * be executing one at time, see {@link #recreateReactContextInBackground()}.
   */
  private final class ReactContextInitAsyncTask extends
      AsyncTask<ReactContextInitParams, Void, Result<ReactApplicationContext>> {

    @Override
    protected Result<ReactApplicationContext> doInBackground(ReactContextInitParams... params) {
      // TODO(t11687218): Look over all threading
      // Default priority is Process.THREAD_PRIORITY_BACKGROUND which means we'll be put in a cgroup
      // that only has access to a small fraction of CPU time. The priority will be reset after
      // this task finishes: https://android.googlesource.com/platform/frameworks/base/+/d630f105e8bc0021541aacb4dc6498a49048ecea/core/java/android/os/AsyncTask.java#256
      Process.setThreadPriority(Process.THREAD_PRIORITY_DEFAULT);

      Assertions.assertCondition(params != null && params.length > 0 && params[0] != null);
      try {
        JavaScriptExecutor jsExecutor = params[0].getJsExecutorFactory().create();
        //异步执行createReactContext()方法，创建ReactContext
        return Result.of(createReactContext(jsExecutor, params[0].getJsBundleLoader()));
      } catch (Exception e) {
        // Pass exception to onPostExecute() so it can be handled on the main thread
        return Result.of(e);
      }
    }

    @Override
    protected void onPostExecute(Result<ReactApplicationContext> result) {
      try {
        //回到主线程，设置ReactContext
        setupReactContext(result.get());
      } catch (Exception e) {
        mDevSupportManager.handleException(e);
      } finally {
        mReactContextInitAsyncTask = null;
      }

      // Handle enqueued request to re-initialize react context.
      if (mPendingReactContextInitParams != null) {
        recreateReactContextInBackground(
            mPendingReactContextInitParams.getJsExecutorFactory(),
            mPendingReactContextInitParams.getJsBundleLoader());
        mPendingReactContextInitParams = null;
      }
    }
}
```

ReactContextInitAsyncTask的doInBackground()方法里调用ReactInstanceManager.createReactContext()最终执行了ReactApplicationContext的创建。
我们重点来看看传入ReactInstanceManager.createReactContext()的2个参数：

```
JavaScriptExecutor jsExecutor：JS执行器，将JS的调用传递给C++层。
JSBundleLoader jsBundleLoader：JS bundle加载器，不同的场景会创建不同的加载器，具体可以查看类JSBundleLoader。
```

这两个参数是ReactInstanceManager.recreateReactContextInBackground()创建ReactContextInitAsyncTask传递进来的，有两个地方调用了ReactInstanceManager.recreateReactContextInBackground()
方法，不同模式获取JS Bundle的方法不一样，jsBundleLoader的创建方式也不一样，如下所示：


```
public class ReactInstanceManager {

  private void onReloadWithJSDebugger(JavaJSExecutor.Factory jsExecutorFactory) {
    recreateReactContextInBackground(
        new ProxyJavaScriptExecutor.Factory(jsExecutorFactory),
        JSBundleLoader.createRemoteDebuggerBundleLoader(
            mDevSupportManager.getJSBundleURLForRemoteDebugging(),
            mDevSupportManager.getSourceUrl()));
  }

  private void onJSBundleLoadedFromServer() {
    recreateReactContextInBackground(
        new JSCJavaScriptExecutor.Factory(mJSCConfig.getConfigMap()),
        JSBundleLoader.createCachedBundleFromNetworkLoader(
            mDevSupportManager.getSourceUrl(),
            mDevSupportManager.getDownloadedJSBundleFile()));
  }

  private void recreateReactContextInBackground(
      JavaScriptExecutor.Factory jsExecutorFactory,
      JSBundleLoader jsBundleLoader) {
    UiThreadUtil.assertOnUiThread();

    ReactContextInitParams initParams =
        new ReactContextInitParams(jsExecutorFactory, jsBundleLoader);
    if (mReactContextInitAsyncTask == null) {
      // No background task to create react context is currently running, create and execute one.
      mReactContextInitAsyncTask = new ReactContextInitAsyncTask();
      mReactContextInitAsyncTask.executeOnExecutor(AsyncTask.THREAD_POOL_EXECUTOR, initParams);
    } else {
      // Background task is currently running, queue up most recent init params to recreate context
      // once task completes.
      mPendingReactContextInitParams = initParams;
    }
  }
}
```
接下来调用ReactInstanceManager.createReactContext()，真正开始创建ReactContext。

### ReactInstanceManager.createReactContext()

```java
public class ReactInstanceManager {

/**
   * @return instance of {@link ReactContext} configured a {@link CatalystInstance} set
   */
  private ReactApplicationContext createReactContext(
      JavaScriptExecutor jsExecutor,
      JSBundleLoader jsBundleLoader) {
    FLog.i(ReactConstants.TAG, "Creating react context.");
    ReactMarker.logMarker(CREATE_REACT_CONTEXT_START);
    //ReactApplicationContext是ReactContext的包装类。
    final ReactApplicationContext reactContext = new ReactApplicationContext(mApplicationContext);
    //创建JavaModule注册表Builder，用来创建JavaModule注册表，JavaModule注册表将所有的JavaModule注册到CatalystInstance中。
    NativeModuleRegistryBuilder nativeModuleRegistryBuilder = new NativeModuleRegistryBuilder(
      reactContext,
      this,
      mLazyNativeModulesEnabled);
    //创建JavaScriptModule注册表Builder，用来创建JavaScriptModule注册表，JavaScriptModule注册表将所有的JavaScriptModule注册到CatalystInstance中。
    JavaScriptModuleRegistry.Builder jsModulesBuilder = new JavaScriptModuleRegistry.Builder();
    if (mUseDeveloperSupport) {
      //如果处于开发模式，则设置NativeModuleCallExceptionHandler，将错误交由DevSupportManager处理（弹出红框，提示错误）。
      reactContext.setNativeModuleCallExceptionHandler(mDevSupportManager);
    }

    ReactMarker.logMarker(PROCESS_PACKAGES_START);
    Systrace.beginSection(
        TRACE_TAG_REACT_JAVA_BRIDGE,
        "createAndProcessCoreModulesPackage");
    try {
      //创建CoreModulesPackage实例，CoreModulesPackage里面封装了RN Framework核心功能，包括：通信、调试等。
      CoreModulesPackage coreModulesPackage =
        new CoreModulesPackage(
          this,
          mBackBtnHandler,
          mUIImplementationProvider,
          mLazyViewManagersEnabled);
      //调用processPackage(0处理CoreModulesPackage，处理的过程就是把各自的Module添加到对应的注册表中。
      processPackage(coreModulesPackage, nativeModuleRegistryBuilder, jsModulesBuilder);
    } finally {
      Systrace.endSection(TRACE_TAG_REACT_JAVA_BRIDGE);
    }

    // TODO(6818138): Solve use-case of native/js modules overriding
    for (ReactPackage reactPackage : mPackages) {
      Systrace.beginSection(
          TRACE_TAG_REACT_JAVA_BRIDGE,
          "createAndProcessCustomReactPackage");
      try {
        //循环处理我们在Application里注入的ReactPackage，处理的过程就是把各自的Module添加到对应的注册表中。
        processPackage(reactPackage, nativeModuleRegistryBuilder, jsModulesBuilder);
      } finally {
        Systrace.endSection(TRACE_TAG_REACT_JAVA_BRIDGE);
      }
    }
    ReactMarker.logMarker(PROCESS_PACKAGES_END);

    ReactMarker.logMarker(BUILD_NATIVE_MODULE_REGISTRY_START);
    Systrace.beginSection(TRACE_TAG_REACT_JAVA_BRIDGE, "buildNativeModuleRegistry");
    NativeModuleRegistry nativeModuleRegistry;
    try {
       //生成Java Module注册表
       nativeModuleRegistry = nativeModuleRegistryBuilder.build();
    } finally {
      Systrace.endSection(TRACE_TAG_REACT_JAVA_BRIDGE);
      ReactMarker.logMarker(BUILD_NATIVE_MODULE_REGISTRY_END);
    }

    //查看外部是否设置NativeModuleCallExceptionHandler，它是在ReactInstanceManagerBuilder构建ReactInstanceManager是传递进来的
    //如果设置了则使用外部NativeModuleCallExceptionHandler，如果没有设置则使用DevSupportManager。
    NativeModuleCallExceptionHandler exceptionHandler = mNativeModuleCallExceptionHandler != null
        ? mNativeModuleCallExceptionHandler
        : mDevSupportManager;
    //jsExecutor、nativeModuleRegistry、nativeModuleRegistry等各种参数处理好之后，开始构建CatalystInstanceImpl实例。
    CatalystInstanceImpl.Builder catalystInstanceBuilder = new CatalystInstanceImpl.Builder()
        .setReactQueueConfigurationSpec(ReactQueueConfigurationSpec.createDefault())
        .setJSExecutor(jsExecutor)
        .setRegistry(nativeModuleRegistry)
        //生成JS Module注册表
        .setJSModuleRegistry(jsModulesBuilder.build())
        .setJSBundleLoader(jsBundleLoader)
        .setNativeModuleCallExceptionHandler(exceptionHandler);

    ReactMarker.logMarker(CREATE_CATALYST_INSTANCE_START);
    // CREATE_CATALYST_INSTANCE_END is in JSCExecutor.cpp
    Systrace.beginSection(TRACE_TAG_REACT_JAVA_BRIDGE, "createCatalystInstance");
    final CatalystInstance catalystInstance;
    try {
      catalystInstance = catalystInstanceBuilder.build();
    } finally {
      Systrace.endSection(TRACE_TAG_REACT_JAVA_BRIDGE);
      ReactMarker.logMarker(CREATE_CATALYST_INSTANCE_END);
    }

    if (mBridgeIdleDebugListener != null) {
      catalystInstance.addBridgeIdleDebugListener(mBridgeIdleDebugListener);
    }
    if (Systrace.isTracing(TRACE_TAG_REACT_APPS | TRACE_TAG_REACT_JSC_CALLS)) {
      //调用CatalystInstanceImpl的Native方法把Java Registry转换为Json，再由C++层传送到JS层。
      catalystInstance.setGlobalVariable("__RCTProfileIsProfiling", "true");
    }

    //关联ReacContext与CatalystInstance
    reactContext.initializeWithInstance(catalystInstance);
    //通过CatalystInstance开始加载JS Bundle
    catalystInstance.runJSBundle();

    return reactContext;
  }
}
```

这个方法有点长，它主要做了以下事情：Csh

```
1 创建JavaModule注册表与JavaScriptModule注册表，这两张表最后都交由CatalystInstance管理。
3 处理ReactPackage，将JavaModule与JavaScriptModule放进各自对应的注册表里。
3 通过上面jsExecutor、nativeModuleRegistry、jsModulesRegistry、jsBundleLoader、exceptionHandler等参数创建CatalystInstance实例。
4 关联ReactContext与CatalystInstance，并将JS Bundle加载进来，等待ReactContextInitAsyncTask结束以后调用JS入口渲染页面。
```

从上面的方法可以看出，在方法中创建了一个CatalystInstanceImpl实例，我们来看看CatalystInstanceImpl是如何被创建的以及它在创建的过程中做了哪些事情。

### CatalystInstanceImpl.CatalystInstanceImpl()

```java
public class CatalystInstanceImpl implements CatalystInstance {

private CatalystInstanceImpl(
      final ReactQueueConfigurationSpec ReactQueueConfigurationSpec,
      final JavaScriptExecutor jsExecutor,
      final NativeModuleRegistry registry,
      final JavaScriptModuleRegistry jsModuleRegistry,
      final JSBundleLoader jsBundleLoader,
      NativeModuleCallExceptionHandler nativeModuleCallExceptionHandler) {
    FLog.w(ReactConstants.TAG, "Initializing React Xplat Bridge.");

    //Native方法，用来创建JNI相关状态，并返回mHybridData。
    mHybridData = initHybrid();

    //RN中的三个线程：Native Modules Thread、JS Thread、UI Thread，都是通过Handler来管理的。
    mReactQueueConfiguration = ReactQueueConfigurationImpl.create(
        ReactQueueConfigurationSpec,
        new NativeExceptionHandler());
    mBridgeIdleListeners = new CopyOnWriteArrayList<>();
    mJavaRegistry = registry;
    mJSModuleRegistry = jsModuleRegistry;
    mJSBundleLoader = jsBundleLoader;
    mNativeModuleCallExceptionHandler = nativeModuleCallExceptionHandler;
    mTraceListener = new JSProfilerTraceListener(this);

    FLog.w(ReactConstants.TAG, "Initializing React Xplat Bridge before initializeBridge");
    //Native方法，调用initializeBridge()方法，并创建BridgeCallback实例，初始化Bridge。
    initializeBridge(
      new BridgeCallback(this),
      jsExecutor,
      mReactQueueConfiguration.getJSQueueThread(),
      mReactQueueConfiguration.getNativeModulesQueueThread(),
      mJavaRegistry.getJavaModules(this),
      mJavaRegistry.getCxxModules());
    FLog.w(ReactConstants.TAG, "Initializing React Xplat Bridge after initializeBridge");
    mMainExecutorToken = getMainExecutorToken();
  }
  
    private native void initializeBridge(
      ReactCallback callback,
      JavaScriptExecutor jsExecutor,
      MessageQueueThread jsQueue,
      MessageQueueThread moduleQueue,
      Collection<JavaModuleWrapper> javaModules,
      Collection<ModuleHolder> cxxModules);
}
```

从CatalystInstanceImpl的构建过程可以看出，CatalystInstanceImpl是个封装管理类，封装了各种注册表，以及初始化JNI，我们来看看最后初始化Bridge传入的6个参数：

```
ReactCallback callback：CatalystInstanceImpl的静态内部类，负责接口回调。
JavaScriptExecutor jsExecutor：JS执行器，将JS的调用传递给C++层。
MessageQueueThread jsQueue.getJSQueueThread()：JS线程，通过mReactQueueConfiguration.getJSQueueThread()获得，mReactQueueConfiguration通过ReactQueueConfigurationSpec.createDefault()创建。
MessageQueueThread moduleQueue：Native线程，通过mReactQueueConfiguration.getNativeModulesQueueThread()获得，mReactQueueConfiguration通过ReactQueueConfigurationSpec.createDefault()创建。
Collection<JavaModuleWrapper> javaModules：java modules。
Collection<ModuleHolder> cxxModules)：c++ modules。
```

从上面的构造方法可以看出，从CatalystInstanceImpl将持有的JavaScriptModule注册表、NativeModule注册表、ReactCallback回调、JavaScriptExecutor、js消息队列
native消息队列都通过JNI传递到C++层。

我们再来看看C++层的实现：

```C++
void CatalystInstanceImpl::initializeBridge(
    jni::alias_ref<ReactCallback::javaobject> callback,
    // This executor is actually a factory holder.
    JavaScriptExecutorHolder* jseh,
    jni::alias_ref<JavaMessageQueueThread::javaobject> jsQueue,
    jni::alias_ref<JavaMessageQueueThread::javaobject> moduleQueue,
    jni::alias_ref<jni::JCollection<JavaModuleWrapper::javaobject>::javaobject> javaModules,
    jni::alias_ref<jni::JCollection<ModuleHolder::javaobject>::javaobject> cxxModules) {
  // TODO mhorowitz: how to assert here?
  // Assertions.assertCondition(mBridge == null, "initializeBridge should be called once");

  // This used to be:
  //
  // Java CatalystInstanceImpl -> C++ CatalystInstanceImpl -> Bridge -> Bridge::Callback
  // --weak--> ReactCallback -> Java CatalystInstanceImpl
  //
  // Now the weak ref is a global ref.  So breaking the loop depends on
  // CatalystInstanceImpl#destroy() calling mHybridData.resetNative(), which
  // should cause all the C++ pointers to be cleaned up (except C++
  // CatalystInstanceImpl might be kept alive for a short time by running
  // callbacks). This also means that all native calls need to be pre-checked
  // to avoid NPE.

  // See the comment in callJSFunction.  Once js calls switch to strings, we
  // don't need jsModuleDescriptions any more, all the way up and down the
  // stack.

  instance_->initializeBridge(folly::make_unique<JInstanceCallback>(callback),
                              jseh->getExecutorFactory(),
                              folly::make_unique<JMessageQueueThread>(jsQueue),
                              folly::make_unique<JMessageQueueThread>(moduleQueue),
                              buildModuleRegistry(std::weak_ptr<Instance>(instance_),
                                                  javaModules, cxxModules));
}
```

我们来看看这个C++函数的参数和Java层的对应关系。

```
callback:JInstanceCallback的实现类。

```

到此CatalystInstanceImpl被创建承诺，CatalystInstanceImpl被创建以后，便进行JS的加载。从ReactInstanceManager.createReactContext()方法可以知道，
最后一步调用CatalystInstanceImpl.runJSBundle()来加载JS Bundle。我们开看一下它的实现。

···java
public class CatalystInstanceImpl{

  @Override
  public void runJSBundle() {
    Assertions.assertCondition(!mJSBundleHasLoaded, "JS bundle was already loaded!");
    mJSBundleHasLoaded = true;

    // incrementPendingJSCalls();
    //调用加载器加载JS Bundle，不同情况下加载器各不相同。
    mJSBundleLoader.loadScript(CatalystInstanceImpl.this);

    synchronized (mJSCallsPendingInitLock) {
      // Loading the bundle is queued on the JS thread, but may not have
      // run yet.  It's safe to set this here, though, since any work it
      // gates will be queued on the JS thread behind the load.
      mAcceptCalls = true;

      for (PendingJSCall call : mJSCallsPendingInit) {
        jniCallJSFunction(call.mExecutorToken, call.mModule, call.mMethod, call.mArguments);
      }
      mJSCallsPendingInit.clear();
    }

    // This is registered after JS starts since it makes a JS call
    Systrace.registerListener(mTraceListener);
  }
}
···

由于不同的情况可能会有不同的JSBundleLoader，我们假设用的是第一种：

```java

 */
public abstract class JSBundleLoader {

  /**
   * This loader is recommended one for release version of your app. In that case local JS executor
   * should be used. JS bundle will be read from assets in native code to save on passing large
   * strings from java to native memory.
   */
  public static JSBundleLoader createAssetLoader(
      final Context context,
      final String assetUrl) {
    return new JSBundleLoader() {
      @Override
      public String loadScript(CatalystInstanceImpl instance) {
        instance.loadScriptFromAssets(context.getAssets(), assetUrl);
        return assetUrl;
      }
    };
  }

}

```

可以看出，它会继续调用CatalystInstanceImpl.loadScriptFromAssets()方法去加载JS Bundle，该方法的实现如下所示：

```java
public class CatalystInstanceImpl {

  /* package */ void loadScriptFromAssets(AssetManager assetManager, String assetURL) {
    mSourceURL = assetURL;
    jniLoadScriptFromAssets(assetManager, assetURL);
  }

  private native void jniLoadScriptFromAssets(AssetManager assetManager, String assetURL);

}
```

可以看出该方法最终调用Native方法jniLoadScriptFromAssets去加载JS Bundle，该方法的实现如下所示：

CatalystInstanceImpl.cpp

```c++

void CatalystInstanceImpl::jniLoadScriptFromAssets(
    jni::alias_ref<JAssetManager::javaobject> assetManager,
    const std::string& assetURL) {
  const int kAssetsLength = 9;  // strlen("assets://");
  //获取source js Bundle的路径名，这里默认的就是index.android.bundle
  auto sourceURL = assetURL.substr(kAssetsLength);
  //assetManager是Java层传递过来的AssetManager，调用JSLoade.cpo里的extractAssetManager()方法，extractAssetManager()再
  //调用android/asset_manager_jni.h里的AAssetManager_fromJava()方法获取AAssetManager对象。
  auto manager = react::extractAssetManager(assetManager);
  //调用JSLoader.cpp的loadScriptFromAssets()方法读取JS Bundle里的内容。
  auto script = react::loadScriptFromAssets(manager, sourceURL);
  //判断是不是unbundle命令打包，build.gradle默认里是bundle打包方式。
  if (JniJSModulesUnbundle::isUnbundle(manager, sourceURL)) {
    instance_->loadUnbundle(
      folly::make_unique<JniJSModulesUnbundle>(manager, sourceURL),
      std::move(script),
      sourceURL);
    return;
  } else {
    //bundle命令打包走次流程，instance_是Instan.h中类的实例。
    instance_->loadScriptFromString(std::move(script), sourceURL);
  }
}

```

JSLoader.cpp

···c++
__attribute__((visibility("default")))
AAssetManager *extractAssetManager(alias_ref<JAssetManager::javaobject> assetManager) {
  auto env = Environment::current();
  return AAssetManager_fromJava(env, assetManager.get());
}

std::unique_ptr<const JSBigString> loadScriptFromAssets(const std::string& assetName) {
  auto env = Environment::current();
  auto assetManager = JApplicationHolder::getApplication()->getAssets();
  return loadScriptFromAssets(AAssetManager_fromJava(env, assetManager.get()), assetName);
}

···

接着会调用Instance.cpp的loadScriptFromString()方法去解析JS Bundle里的内容。 

Instance.cpp

```c++
void Instance::loadScriptFromString(std::unique_ptr<const JSBigString> string,
                                    std::string sourceURL) {
  callback_->incrementPendingJSCalls();
  SystraceSection s("reactbridge_xplat_loadScriptFromString",
                    "sourceURL", sourceURL);
  //nativeToJsBridge_也是在Instance::initializeBridget()方法里初始化的，具体实现在NativeToJsBridge.cpp里。
  nativeToJsBridge_->loadApplication(nullptr, std::move(string), std::move(sourceURL));
}

```

loadScriptFromString()进一步调用NativeToJsBridge.cpp的loadApplication()方法，它的实现如下所示：

NativeToJsBridge.cpp

```c++
void NativeToJsBridge::loadApplication(
    std::unique_ptr<JSModulesUnbundle> unbundle,
    std::unique_ptr<const JSBigString> startupScript,
    std::string startupScriptSourceURL) {

  //获取一个MessageQueueThread，探后在线程中执行一个Task。
  runOnExecutorQueue(
      m_mainExecutorToken,
      [unbundleWrap=folly::makeMoveWrapper(std::move(unbundle)),
       startupScript=folly::makeMoveWrapper(std::move(startupScript)),
       startupScriptSourceURL=std::move(startupScriptSourceURL)]
        (JSExecutor* executor) mutable {

    auto unbundle = unbundleWrap.move();
    if (unbundle) {
      executor->setJSModulesUnbundle(std::move(unbundle));
    }

    //executor从runOnExecutorQueue()返回的map中取得，与OnLoad中的JSCJavaScriptExecutorHolder对应，也与
    //Java中的JSCJavaScriptExecutor对应。它的实例在JSExecutor.cpp中实现。
    executor->loadApplicationScript(std::move(*startupScript),
                                    std::move(startupScriptSourceURL));
  });
}

关于unbundle命令

<unbundle命令，使用方式和bundle命令完全相同。unbundle命令是在bundle命令的基础上增加了一项功能，除了生成整合JS文件index.android.bundle外，还会
生成各个单独的未整合JS文件（但会被优化），全部放在js-modules目录下，同时会生成一个名为UNBUNDLE的标识文件，一并放在其中。UNBUNDLE标识文件的前4个字节
固定为0xFB0BD1E5，用于加载前的校验。

```
我们先来看看这个函数的3个参数：

```
std::unique_ptr<JSModulesUnbundle> unbundle：空指针，因为我们用的bundle方式打包。
std::unique_ptr<const JSBigString> startupScript：bundle的文件内容。
std::string startupScriptSourceURL：bundle的文件名。
```

该函数进一步调用JSExecutor.cpp的loadApplicationScript()方法。

JSExecutor.cpp

```c++

void JSCExecutor::loadApplicationScript(std::unique_ptr<const JSBigString> script, std::string sourceURL) {
  SystraceSection s("JSCExecutor::loadApplicationScript",
                    "sourceURL", sourceURL);

  ReactMarker::logMarker("RUN_JS_BUNDLE_START");
  String jsSourceURL(m_context, sourceURL.c_str());

  // TODO t15069155: reduce the number of overrides here
#ifdef WITH_FBJSCEXTENSIONS
  if (auto fileStr = dynamic_cast<const JSBigFileString *>(script.get())) {
    JSLoadSourceStatus jsStatus;
    auto bcSourceCode = JSCreateSourceCodeFromFile(fileStr->fd(), jsSourceURL, nullptr, &jsStatus);

    switch (jsStatus) {
    case JSLoadSourceIsCompiled:
      if (!bcSourceCode) {
        throw std::runtime_error("Unexpected error opening compiled bundle");
      }

      //使用Webkit JSC去解释执行JS
      evaluateSourceCode(m_context, bcSourceCode, jsSourceURL);
      //绑定bridge，核心就是通过getGlobalObject()将JS与C++通过Webkit jSC实现绑定
      bindBridge();
      flush();

      ReactMarker::logMarker("CREATE_REACT_CONTEXT_END");
      ReactMarker::logMarker("RUN_JS_BUNDLE_END");
      return;

    case JSLoadSourceErrorVersionMismatch:
      throw RecoverableError(explainLoadSourceStatus(jsStatus));

    case JSLoadSourceErrorOnRead:
    case JSLoadSourceIsNotCompiled:
      // Not bytecode, fall through.
      break;
    }
  }
#elif defined(__APPLE__)
  BundleHeader header;
  memcpy(&header, script->c_str(), std::min(script->size(), sizeof(BundleHeader)));
  auto scriptTag = parseTypeFromHeader(header);

  if (scriptTag == ScriptTag::BCBundle) {
    using file_ptr = std::unique_ptr<FILE, decltype(&fclose)>;
    file_ptr source(fopen(sourceURL.c_str(), "r"), fclose);
    int sourceFD = fileno(source.get());

    JSValueRef jsError;
    JSValueRef result = JSC_JSEvaluateBytecodeBundle(m_context, NULL, sourceFD, jsSourceURL, &jsError);
    if (result == nullptr) {
      formatAndThrowJSException(m_context, jsError, jsSourceURL);
    }
  } else
#endif
  {
    #ifdef WITH_FBSYSTRACE
    fbsystrace_begin_section(
      TRACE_TAG_REACT_CXX_BRIDGE,
      "JSCExecutor::loadApplicationScript-createExpectingAscii");
    #endif

    ReactMarker::logMarker("loadApplicationScript_startStringConvert");
    String jsScript = jsStringFromBigString(m_context, *script);
    ReactMarker::logMarker("loadApplicationScript_endStringConvert");

    #ifdef WITH_FBSYSTRACE
    fbsystrace_end_section(TRACE_TAG_REACT_CXX_BRIDGE);
    #endif

    evaluateScript(m_context, jsScript, jsSourceURL);
  }

  bindBridge();
  flush();

  ReactMarker::logMarker("CREATE_REACT_CONTEXT_END");
  ReactMarker::logMarker("RUN_JS_BUNDLE_END");
}
```

evaluateScript()方法调用Webkit jSC开始解析执行JS，并调用bindBridge()绑定bridge，我们这里主要分析的启动流程，先不分析JS渲染过程，先看看Bridge绑定
流程，bindBridge()的实现如下所示：

JSExecutor.cpp

```c++
void JSCExecutor::bindBridge() throw(JSException) {
  SystraceSection s("JSCExecutor::bindBridge");
  if (!m_delegate || !m_delegate->getModuleRegistry()) {
    return;
  }
  auto global = Object::getGlobalObject(m_context);
  auto batchedBridgeValue = global.getProperty("__fbBatchedBridge");
  if (batchedBridgeValue.isUndefined()) {
    throwJSExecutionException("Could not get BatchedBridge, make sure your bundle is packaged correctly");
  }

  auto batchedBridge = batchedBridgeValue.asObject();
  m_callFunctionReturnFlushedQueueJS = batchedBridge.getProperty("callFunctionReturnFlushedQueue").asObject();
  m_invokeCallbackAndReturnFlushedQueueJS = batchedBridge.getProperty("invokeCallbackAndReturnFlushedQueue").asObject();
  //通过Webkit JSC获取MessageQueue.js的flushedQueue。
  m_flushedQueueJS = batchedBridge.getProperty("flushedQueue").asObject();
  m_callFunctionReturnResultAndFlushedQueueJS = batchedBridge.getProperty("callFunctionReturnResultAndFlushedQueue").asObject();
}

void JSCExecutor::callNativeModules(Value&& value) {
  SystraceSection s("JSCExecutor::callNativeModules");
  try {
    //把JS层相关通信数据转换为JSON格式
    auto calls = value.toJSONString();
    //m_delegate为JsToNativeBridge对象。
    m_delegate->callNativeModules(*this, folly::parseJson(calls), true);
  } catch (...) {
    std::string message = "Error in callNativeModules()";
    try {
      message += ":" + value.toString().str();
    } catch (...) {
      // ignored
    }
    std::throw_with_nested(std::runtime_error(message));
  }
}

void JSCExecutor::flush() {
  SystraceSection s("JSCExecutor::flush");
  if (!m_delegate) {
    // do nothing
  } else if (!m_delegate->getModuleRegistry()) {
    callNativeModules(Value::makeNull(m_context));
  } else {
    // If this is failing, chances are you have provided a delegate with a
    // module registry, but haven't loaded the JS which enables native function
    // queueing.  Add BatchedBridge.js to your bundle, pass a nullptr delegate,
    // or make delegate->getModuleRegistry() return nullptr.
    CHECK(m_flushedQueueJS) << "Attempting to use native methods without loading BatchedBridge.js";
    //m_flushedQueueJS->callAsFunction({})等于调用MessageQueue.js的flushedQUeue()方法，即把JS层相关通信数据通过flushedQUeue()
    //返回给callNativeModules
    callNativeModules(m_flushedQueueJS->callAsFunction({}));
  }
}
```

通过上面代码可知，最终又调用了JsToNativeBridge.cpp的callNativeModules()方法。我们再来看看这个方法的实现：

JsToNativeBridge.cpp

```c++
  void callNativeModules(
      JSExecutor& executor, folly::dynamic&& calls, bool isEndOfBatch) override {

    CHECK(m_registry || calls.empty()) <<
      "native module calls cannot be completed with no native modules";
    ExecutorToken token = m_nativeToJs->getTokenForExecutor(executor);
    //放到NativeQueue的线程队列中去等待执行
    m_nativeQueue->runOnQueue([this, token, calls=std::move(calls), isEndOfBatch] () mutable {
      // An exception anywhere in here stops processing of the batch.  This
      // was the behavior of the Android bridge, and since exception handling
      // terminates the whole bridge, there's not much point in continuing.
      for (auto& call : react::parseMethodCalls(std::move(calls))) {
        //调用NativeModuleRegistry中的Java Native方法。
        m_registry->callNativeMethod(
          token, call.moduleId, call.methodId, std::move(call.arguments), call.callId);
      }
      if (isEndOfBatch) {
        m_callback->onBatchComplete();
        m_callback->decrementPendingJSCalls();
      }
    });
  }
```

我们先来看看这个函数的3个参数：

```
JSExecutor& executor：即前面我们分析过的JSCExecutor
folly::dynamic&& calls：解析成功的JS的JSON通信参数结构
bool isEndOfBatch：通知当前的JS Bundle是否处理完成。
```


```java
public class CatalystInstanceImpl {implements CatalystInstance {

  public native void setGlobalVariable(String propName, String jsonValue);
  
}
```

总结一下上述的整个路程

```
1 在程序启动的时候，也就是ReContextactActivity的onCreate函数中，我们会去创建一个ReactInstanceManagerImpl对象

2 通过ReactRootView的startReactApplication方法开启整个RN世界的大门

3 在这个方法中，我们会通过一个AsyncTask去创建ReactContext

4 在创建ReactContext过程中，我们把我们自己注入(MainReactPackage)的和系统生成(CoreModulesPackage)的package通过processPackage方法将其中的各个modules注入到了对应的Registry中

5 最后通过CatalystInstanceImpl中的ReactBridge将java的注册表通过jni传输到了JS层。
```



