# ReactNative源码篇：源码初识

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

源码地址：https://github.com/facebook/react-native

源码版本：[![Build Status](https://travis-ci.org/facebook/react-native.svg?branch=master)](https://travis-ci.org/facebook/react-native) [![Circle CI](https://circleci.com/gh/facebook/react-native.svg?style=shield)](https://circleci.com/gh/facebook/react-native) [![npm version](https://badge.fury.io/js/react-native.svg)](https://badge.fury.io/js/react-native)

本篇文章是《ReactNative源码篇》的第一篇文章，刚开始，我们先不对源码做深入的分析，我们先要对源码的结构和ReactNative的框架有个大致的印象，
由此便引出了本篇文章需要讨论的两个问题：

```
1. ReactNative系统框架是怎样的？
2. ReactNative系统框架的主线在哪里，有哪些支线，如何去分析这些线路？
```
好，我们先来看第一个问题。

## 一 ReactNative系统框架概述

ReactNative源码结构图

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/1/source_code_structure_package.png"/>

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

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/1/source_code_structure_call.png" width="1000"/>

ReactNative系统框架图如下所示：

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/1/react_native_system_strcuture.png" width="1000"/>

>注：JSCore，即JavaScriptCore，JS解析的核心部分，IOS使用的是内置的JavaScriptCore，Androis上使用的是https://webkit.org/家的jsc.so。

## 二 ReactNative源码的主线与支线

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

上面便是整个源码的主线与支线，了解了大致的流程。我们再来理解一些重要的概念，方便后续的源码展开分析。

## 三 ReactNative源码的重要概念

### 3.1 ReactContext

>ReactContext继承于ContextWrapper，是ReactNative应用的上下文，通过getContext()去获得，通过它可以访问ReactNative核心类的实现。

整个启动流程重要创建实例之一就是ReactContext，在正式介绍启动流程之前，我们先来了接一下ReactContext的概念。

>ReactContext继承于ContextWrapper，也就是说它和Android中的Context是一个概念，是整个应用的上下文。那么什么是上下文呢，我们知道Android的应用模型是基于组件的应用设计模式，
组件的运行需要完整的运行环境，这种运行环境便是应用的上下文。

上面的概念可能有点抽象，我们举个例子说明一下。

用户与操作系统的每一次交互都是一个场景，例如：打电话、发短信等有节目的场景（Activity），后台播放音乐等没有节目的场景（Service），这种交互的场景（Activity、Service等）都被
抽象成了上下文环境（Context），它代表了当前对象再应用中所处的一个环境、一个与系统交互的过程。

我们来了解一下ReactContext的具体实现与功能，先来看一下它的类图：

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/2/UMLClassDiagram-bridge-ReactContext.png"/>

从上图可以看出，ReactContext继承与ContextWrapper，并有子类：

```
ReactApplicationContext：继承于ReactContext，ReactContext的wrapper类，就像Context与ContextWrapper的关系一样。
ThemedReactContext：继承于ReactContext，也是ReactContext的wrapper类。
```

### 3.2 ReactInstanceManager

>ReactInstanceManager是ReactNative应用总的管理类，创建ReactContext、CatalystInstance等类，解析ReactPackage生成映射表，并且配合ReactRootView管理View的创建与生命周期等功能。

### 3.3 CatalystInstance

>CatalystInstance是ReactNative应用Java层、C++层、JS层通信总管理类，总管Java层、JS层核心Module映射表与回调，三端通信的入口与桥梁。

### 3.4 NativeToJsBridge/JsToNativeBridge

>NativeToJsBridge是Java调用JS的桥梁，用来调用JS Module，回调Java。

>JsToNativeBridge是JS调用Java的桥梁，用来调用Java Module。

### 3.5 JavaScriptModule/NativeModule

>JavaScriptModule是JS Module，负责JS到Java的映射调用格式声明，由CatalystInstance统一管理。

>NativeModule是ava Module，负责Java到Js的映射调用格式声明，由CatalystInstance统一管理。


JavaScriptModule：JS暴露给Java调用的API集合，例如：AppRegistry、DeviceEventEmitter等。业务放可以通过继承JavaScriptModule接口类似自定义接口模块，声明
与JS相对应的方法即可。

NativeModule/UIManagerModule：NativeModule是Java暴露给JS调用的APU集合，例如：ToastModule、DialogModule等，UIManagerModule也是供JS调用的API集
合，它用来创建View。业务放可以通过实现NativeModule来自定义模块，通过getName()将模块名暴露给JS层，通过@ReactMethod注解将API暴露给JS层。

### 3.6 JavascriptModuleRegistry

>JavascriptModuleRegistry是JS Module映射表，NativeModuleRegistry是Java Module映射表

## 附录

为了方便大家理解，准备了导读PPT。

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片01.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片02.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片03.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片04.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片05.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片06.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片07.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片08.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片09.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片10.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片11.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片12.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片13.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片14.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片15.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片16.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片17.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片18.png"/>
<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/ppt/幻灯片19.png"/>
