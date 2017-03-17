# ReactNative源码篇：源码初识


作者: 郭孝星<br/>
邮箱: guoxiaoxingse@163.com<br/>
博客: https://guoxiaoxing.github.io/<br/>
简书: http://www.jianshu.com/users/66a47e04215b/latest_articles<br/>

**关于作者**

>郭孝星，非著名程序员，代码洁癖患者，爱编程，好吉他，喜烹饪，爱一切有趣的事物和人。

**关于文章**

>作者的文章会同时发布在Github、CSDN与简书上, 文章顶部也会附上文章的Github链接。如果文章中有什么疑问也欢迎发邮件与我交流, 对于交流的问
题, 请描述清楚问题并附上代码与日志, 一般都会给予回复。如果文章中有什么错误, 也欢迎斧正。如果你觉得本文章对你有所帮助, 也欢迎去star文
章, 关注文章的最新的动态。另外建议大家去Github上浏览文章，一方面文章的写作都是在Github上进行的，所以Github上的更新是最及时的，另一方
面感觉Github对Markdown的支持更好，文章的渲染也更加美观。

文章目录：https://github.com/guoxiaoxing/awesome-react-native

源码地址：https://github.com/facebook/react-native

源码版本：[![Build Status](https://travis-ci.org/facebook/react-native.svg?branch=master)](https://travis-ci.org/facebook/react-native) [![Circle CI](https://circleci.com/gh/facebook/react-native.svg?style=shield)](https://circleci.com/gh/facebook/react-native) [![npm version](https://badge.fury.io/js/react-native.svg)](https://badge.fury.io/js/react-native)

本篇文章是《ReactNative源码篇》的第一篇文章，刚开始，我们先不对源码做深入的分析，我们先要对源码的结构和ReactNative的框架有个大致的印象，
由此便引出了本篇文章需要讨论的两个问题：

1. ReactNative系统框架是怎样的？
2. ReactNative系统框架的主线在哪里，有哪些支线，如何去分析这些线路？

好，我们先来看第一个问题。

## ReactNative系统框架概述

ReactNative源码结构图

<img src="https://github.com/guoxiaoxing/awesome-react-native/blob/master/art/source/1/source_code_structure_2.png"/>

- jni：ReactNative的好多机制都是由C、C++实现的，这部分便是用来载入SO库。
- perftest：测试配置
- proguard：混淆
- quicklog：log输出
- react：ReactNative源码的主要内容，也是我们分析的主要内容。
- systrace：system trace
- yoga：瑜伽？哈哈，并不是，是facebook开源的前端布局引擎

react依赖另外几个包，它们的调用关系如下图所示：

<img src="https://github.com/guoxiaoxing/awesome-react-native/blob/master/art/source/1/source_code_structure_3.png"/>

## ReactNative系统框架主线与支线