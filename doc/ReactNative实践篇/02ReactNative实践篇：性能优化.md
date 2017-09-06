# ReactNative实践篇：崩溃分析

**关于作者**

>郭孝星，非著名程序员，主要从事Android平台基础架构与中间件方面的工作，欢迎交流技术方面的问题，可以去我的[Github](https://github.com/guoxiaoxing)提交Issue或者发邮件至guoxiaoxingse@163.com与我联系。

文章目录：https://github.com/guoxiaoxing/react-native/blob/master/README.md

React Native 应用 crash主要来源

Bundle 加载

处理 ReactInstanceManagerImpl 的 createReactContext 直接抛出的 RuntimeException 问题。


JavaScript 执行

处理 NativeExceptionsManagerModule的 reportFatalException 直接抛出的 JavaScriptException 问题。


Native 模块

实现 NativeModuleCallExceptionExceptionHandler 即可。


SOLoader错误

给loadLibrary 添加 try/catch, 在 catch 中添加load补偿。