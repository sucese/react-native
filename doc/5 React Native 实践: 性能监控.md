# 崩溃分析

React Native 应用 crash主要来源

Bundle 加载

处理 ReactInstanceManagerImpl 的 createReactContext 直接抛出的 RuntimeException 问题。


JavaScript 执行

处理 NativeExceptionsManagerModule的 reportFatalException 直接抛出的 JavaScriptException 问题。


Native 模块

实现 NativeModuleCallExceptionExceptionHandler 即可。


SOLoader错误

给loadLibrary 添加 try/catch, 在 catch 中添加load补偿。