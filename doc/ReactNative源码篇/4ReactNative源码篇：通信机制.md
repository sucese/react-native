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
