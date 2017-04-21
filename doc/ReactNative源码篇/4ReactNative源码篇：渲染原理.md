# ReactNative源码篇：渲染原理

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

>本篇系列文章主要分析ReactNative源码，分析ReactNative的启动流程、渲染原理、通信机制与线程模型等方面内容。

- [1ReactNative源码篇：源码初识](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/1ReactNative源码篇：源码初识.md)
- [2ReactNative源码篇：代码调用](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：代码调用.md)
- [3ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/3ReactNative源码篇：启动流程.md)
- [4ReactNative源码篇：渲染原理](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/4ReactNative源码篇：渲染原理.md)
- [6ReactNative源码篇：线程模型](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/5ReactNative源码篇：线程模型.md)
- [5ReactNative源码篇：通信机制](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/6ReactNative源码篇：通信机制.md)
                

## 工作机制

### 状态机

>RN将所有UI视为一个简单的状态机，任意一个UI场景都是状态机的一种状态。


### 生命周期

1 getDefaultProps()

组件首次实例化时初始化默认props属性，多实例共享。

2 getInitialState()

组件实例化时初始化默认的state属性。

3 componentWillMount()

在渲染之前触发一次。

4 render()

渲染函数，返回DOM结构。

5 componentDisMount()

在渲染之后触发一次。

6 componentWillReceiveProps()

组件接收到新的props调用，并将其作为参数nextProps使用，可以在此更改组件state。

7 shouldComponentUpdate()

判断是否需要更新组件

8 componentWillUpdate()

重新渲染前调用

9 componentWillUnmount()

组件移除前调用

																	
这篇文章我们来分析JSX如何渲染成原生的页面的，在文章- [3ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/3ReactNative源码篇：启动流程.md)中
ReactInstanceManager.setupReactContext()方法中，我们会调用attachMeasuredRootViewToInstance()方法去设置View，我们来回顾一下该方法的实现。

## 渲染原理


**举例**

在讲解原理之前，我们先来看一个简单的例子：

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

...

//注册组件名，JS与Java格子各自维护了一个注册表
AppRegistry.registerComponent('standard_project', () => standard_project);
```

我们知道render()函数返回的要绘制页面的DOM结构，为了更直观的理解他的实现，我们先把render()函数里的JSX代码换成JS代码，如下所示：

```
'use strict';

React.createElement(
  View,
  { style: styles.container },
  React.createElement(
    Text,
    { style: styles.welcome },
    'Welcome to React Native!'
  ),
  React.createElement(
    Text,
    { style: styles.instructions },
    'To get started, edit index.android.js'
  ),
  React.createElement(
    Text,
    { style: styles.instructions },
    'Double tap R on your keyboard to reload,',
    '\n',
    'Shake or press menu button for dev menu'
  )
);
```

可以看到View的创建实际上调用了React.createElement()，该方法的签名如下所示：

```javascript
ReactElement.createElement = function (type, config, children){ ... }
```

然后该方法按照以下调用链：



```java

public class ReactInstanceManager{

private void attachMeasuredRootViewToInstance(
      ReactRootView rootView,
      CatalystInstance catalystInstance) {

	...

    //将ReactRootView作为根布局
    UIManagerModule uiManagerModule = catalystInstance.getNativeModule(UIManagerModule.class);
    int rootTag = uiManagerModule.addMeasuredRootView(rootView);
    //设置相关
    rootView.setRootViewTag(rootTag);

    ...
  }
}
```