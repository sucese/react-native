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

>通信，指的是RN中Java与JS的通信，即JS中的JSX代码如何转化成Java层真实的View与事件的，以及Java层又是如何调用JS来找出它需要的View与
事件的。

RN的两端通信依赖一张通信表，Java端与JS端各自持有一张表，通信的时候就睡通过这张表的各个条目的一一对应来进行的。

我们知道当我们用react-native init project创建了一个项目后，自动生成的MainApplication里有这么一段代码：

```java
public class MainApplication extends Application implements ReactApplication {

  //实例化ReactNativeHost，并实现了它的抽象方法getUseDeveloperSupport()与getPackages() 
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
    SoLoader.init(this, /* native exopackage */ false);
  }
}

```

>ReactNativeHost是

上述代码中实例化ReactNativeHost，并实现了它的抽象方法getPackages()，该方法返回一些ReactPackage，这些ReactPackage定义了基础的组件与事件。我们自定义组件时，通常也要自己写
一个package，注册表就是通过这些package生成的。

ReactInstanceManager也持有ReactNativeManager的实例，它的代码里有一段创建ReactNaiveManager的方法：

```java
public abstract class ReactNativeHost {

  protected ReactInstanceManager createReactInstanceManager() {
    ReactInstanceManagerBuilder builder = ReactInstanceManager.builder()
      .setApplication(mApplication)
      .setJSMainModuleName(getJSMainModuleName())
      .setUseDeveloperSupport(getUseDeveloperSupport())
      .setRedBoxHandler(getRedBoxHandler())
      .setUIImplementationProvider(getUIImplementationProvider())
      .setInitialLifecycleState(LifecycleState.BEFORE_CREATE);

    for (ReactPackage reactPackage : getPackages()) {
      builder.addPackage(reactPackage);
    }

    String jsBundleFile = getJSBundleFile();
    if (jsBundleFile != null) {
      builder.setJSBundleFile(jsBundleFile);
    } else {
      builder.setBundleAssetName(Assertions.assertNotNull(getBundleAssetName()));
    }
    return builder.build();
  }
  
}
```

可以看出，ReactInstanceManagerBuilder通过builder模式来创建ReactInstanceManager，配置Application、JSMainModuleName与ReactPackage等信息。builder.build()最后返回的
是一个ReactNativeManagerImpl的实例。


我们知道RN的页面都是继承ReactActivity来实现的，ReactActivity继承于Activity，并实现了它的生命周期方法。ReactActivity自己并没有做什么事情，所有的功能都由它的代理类ReactActivityDelegate来完成。

如下所示：

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/4/ClusterCallButterfly-react-ReactActivity.png"/>

所以我们主要来关注ReactActivityDelegate的实现。

我们先看看ReactActivityDelegate的创建流程，即它的onCreate()方法：

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
    //创建ReactRootView作为根视图
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

在ReactActivityDelegate.onCreate()方法里，ReactActivityDelegate做了开发模式的判断以及一些权限检查，创建ReactRootView作为应用根视图，并调用ReactRootView.startReactApplication()方法启动RN应用。我们
接着来看startReactApplication()的实现。

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

ReactRootView.startReactApplication()方法里最终会调用ReactInstanceManager.createReactContextInBackground()去执行ReactContext的创建。

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

    if (mUseDeveloperSupport && mJSMainModuleName != null) {
      final DeveloperSettings devSettings = mDevSupportManager.getDevSettings();

      // If remote JS debugging is enabled, load from dev server.
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

    recreateReactContextInBackgroundFromBundleLoader();
  }

  private void recreateReactContextInBackgroundFromBundleLoader() {
    recreateReactContextInBackground(
        new JSCJavaScriptExecutor.Factory(mJSCConfig.getConfigMap()),
        mBundleLoader);
  }

}
```