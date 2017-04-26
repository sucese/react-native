# ReactNative源码篇：源码初识

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
- [5ReactNative源码篇：线程模型](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/5ReactNative源码篇：线程模型.md)
- [6ReactNative源码篇：通信机制](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/6ReactNative源码篇：通信机制.md)
								

源码地址：https://github.com/facebook/react-native

源码版本：[![Build Status](https://travis-ci.org/facebook/react-native.svg?branch=master)](https://travis-ci.org/facebook/react-native) [![Circle CI](https://circleci.com/gh/facebook/react-native.svg?style=shield)](https://circleci.com/gh/facebook/react-native) [![npm version](https://badge.fury.io/js/react-native.svg)](https://badge.fury.io/js/react-native)

本篇文章是《ReactNative源码篇》的第一篇文章，刚开始，我们先不对源码做深入的分析，我们先要对源码的结构和ReactNative的框架有个大致的印象，
由此便引出了本篇文章需要讨论的两个问题：

```
1. ReactNative系统框架是怎样的？
2. ReactNative系统框架的主线在哪里，有哪些支线，如何去分析这些线路？
```

好，我们先来看第一个问题。

## ReactNative系统框架概述

ReactNative源码结构图

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/1/source_code_structure_2.png"/>

```
- jni：ReactNative的好多机制都是由C、C++实现的，这部分便是用来载入SO库。
- perftest：测试配置
- proguard：混淆
- quicklog：log输出
- react：ReactNative源码的主要内容，也是我们分析的主要内容。
- systrace：system trace
- yoga：瑜伽？哈哈，并不是，是facebook开源的前端布局引擎
```

react依赖另外几个包，它们的调用关系如下图所示：

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/1/source_code_structure_3.png" width="1000"/>

ReactNative系统框架图如下所示：

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/1/react_native_system_strcuture.png" width="1000"/>

>注：JSCore，即JavaScriptCore，JS解析的核心部分，IOS使用的是内置的JavaScriptCore，Androis上使用的是https://webkit.org/家的jsc.so。

## ReactNative系统框架主线与支线

从上面对ReactNative系统框架的分析，我们很容易看出源码的主线就在于ReactNative的启动流程、UI的绘制与渲染以及双边通信（Java调用JS，JS调用Java）。

源码主线：

```
1 ReactNative应用启动流程
2 ReactNative应用UI的绘制与渲染
3 ReactNative应用通信机制
3 ReactNative应用线程模型
```

源码支线：

```
1 ReactNative运行时的异常以及异常的捕获与处理。
2 SOLoader加载动态链接库
3 ReactNative触摸事件处理机制
```

在正式开始分析源码之前，我们先简单介绍一下各个类的作用，让大家先有个大概的印象，方便以后的讲解。

ReactContext(Java层)

```
继承于ContextWrapper，是RN应用的上下文，通过getContext()去获得，通过它可以访问RN核心类的实现。
```
ReactInstanceManagerImpl/ReactInstanceManagerImpl(Java层)

```
RN应用总的管理类，创建ReactContext、CatalystInstance等类，解析ReactPackage生成映射表，并且配合ReactRootView管理View的创建与生命周期等功能。
```

CatalystInstance/CatalystInstanceImpl(Java层/C++层)

```
RN应用Java层、C++层、JS层通信总管理类，总管Java层、JS层核心Module映射表与回调，三端通信的入口与桥梁。
```

NativeToJsBridge(C++层)

```
Java调用JS的桥梁，用来调用JS Module，回调Java。
```

JsToNativeBridge(C++层)

```
JS调用Java的桥梁，用来调用Java Module。
```

JSCExecutor(C++层)

```
管理WebKit的JavaScriptCore，JS与C++的转换桥接都在这里进行中转处理。
```
MessageQueue(JS层)

```
JS调用队列，调用Java Module或者JS Module的方法，处理回调。
```

JavaScriptModule(Java层)

```
JS Module，负责JS到Java的映射调用格式声明，由CatalystInstance统一管理。
```

ReactContextBaseJavaModule/BaseJavaModule/NativeModule(Java层)

```
Java Module，负责Java到Js的映射调用格式声明，由CatalystInstance统一管理。
```

JavascriptModuleRegistry(Java层)

```
JS Module映射表
```
NativeModuleRegistry(Java层)

```
Java Module映射表
```


## 附录

为了方便大家理解，准备了导读PPT。


<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片01.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片02.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片03.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片04.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片05.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片06.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片07.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片08.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片09.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片10.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片11.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片12.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片13.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片14.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片15.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片16.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片17.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片18.png"/>
<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/ppt/幻灯片19.png"/>
