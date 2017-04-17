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
1 RN应用的启动调用流程，各组件完成的功能。😌
```

好，我们先从ReactActivity入手。


通过以上我们对Java与JS的调用有了大致的了解，我们来进一步分析启动流程，话不多说，先上启动流程图。


我们来介绍下上图中各个组件的功能。

ReactRootView

>ReactRootView，JS Application的根视图，用来处理的UI的大小变化与视图绘制。并监听用户触摸事件，通过JSTouchDispatcher将事件发送给JS端。

ReactInstanceManager

>ReactInstanceManagerp，JS Application实例的管理器，构建了JS Application的运行环境，发送事件给JS，驱动JS Application的运转，它与
ReactRootView所在的Activity有着相同的生命周期，通过Builder还可以配置不同的React环境，比如内置JS路径，开发环境支持，是否支持调试，为开
发者连接了DevSupport。

CatalystInstance

>CatalystInstance，异步JSCAPI的顶级封装类，提供Java与JS通信的环境，通过ReactBridge将JS Bundle传递到JS引擎。

NativeModuleRegistry

>NativeModuleRegistry，Java模块注册表，暴露给JS的API集合。

JavascriptModuleRegistry

>JavascriptModuleRegistry，JS模块注册表，负责将所有的JavascriptModule注册到CatalystInstance，Java则通过动态代理调用JS。