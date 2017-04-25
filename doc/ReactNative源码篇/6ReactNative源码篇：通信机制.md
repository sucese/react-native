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
                						
>通信，指的是RN中Java与JS的通信，即JS中的JSX代码如何转化成Java层真实的View与事件的，以及JavaFile层又是如何调用JS来找出它需要的View与
事件的。

在上一篇文章[ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/3ReactNative源码篇：启动流程.md)中，我们知道RN应用在启动的时候会创建JavaScriptModule注册表（JavaScriptModuleRegistry）与NativeModule注册表（NativeModuleRegistry），RN中Java层
与JS层的通信就是通过这两张表来完成的，我们来详细看一看。

在正式开始分析通信机制之前，我们先了解和本篇文章相关的一些重要概念。

在正式介绍通信机制之前，我们先来了解一些核心的概念。

**JavaScript Module注册表**

说起JavaScript Module注册表，我们需要先理解3个类/接口：JavaScriptModule、JavaScriptModuleRegistration、JavaScriptModuleRegistry。

**JavaScriptModule**

```
JavaScriptModule：这是一个接口，JS Module都会继承此接口，它表示在JS层会有一个相同名字的js文件，该js文件实现了该接口定义的方法，JavaScriptModuleRegistry会利用
动态代理将这个接口生成代理类，并通过C++传递给JS层，进而调用JS层的方法。
```
**JavaScriptModuleRegistration**

```
JavaScriptModuleRegistration用来描述JavaScriptModule的相关信息，它利用反射获取接口里定义的Method。
```
**JavaScriptModuleRegistry**

```
JavaScriptModuleRegistry：JS Module注册表，内部维护了一个HashMap：HashMap<Class<? extends JavaScriptModule>, JavaScriptModuleRegistration> mModuleRegistrations，
JavaScriptModuleRegistry利用动态代理生成接口JavaScriptModule对应的代理类，再通过C++传递到JS层，从而调用JS层的方法。
```

**Java Module注册表**

要理解Java Module注册表，我们同样也需要理解3个类/接口：NativeModule、ModuleHolder、NativeModuleRegistry。

**NativeModule**

```
NativeModule：是一个接口，实现了该接口则可以被JS层调用，我们在为JS层提供Java API时通常会继承BaseJavaModule/ReactContextBaseJavaModule，这两个类就
实现了NativeModule接口。
```
**ModuleHolder**

```
ModuleHolder：NativeModule的一个Holder类，可以实现NativeModule的懒加载。
```

**NativeModuleRegistry**

```
NativeModuleRegistry：Java Module注册表，内部持有Map：Map<Class<? extends NativeModule>, ModuleHolder> mModules，NativeModuleRegistry可以遍历
并返回Java Module供调用者使用。
```

好，了解了这些重要概念，我们开始分析整个RN的通信机制。

## 一 配置表的实现

### 配置表的定义

函数配置表定义在NativeModule.h中。

```
struct MethodDescriptor {
  std::string name;
  // type is one of js MessageQueue.MethodTypes
  std::string type;

  MethodDescriptor(std::string n, std::string t)
      : name(std::move(n))
      , type(std::move(t)) {}
};
```

method的定义

```java
public class JavaModuleWrapper {
  public class MethodDescriptor {
    @DoNotStrip
    Method method;
    @DoNotStrip
    String signature;
    @DoNotStrip
    String name;
    @DoNotStrip
    String type;
  }
}
```


### 配置表的创建

在文章[ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：启动流程.md)中，我们可以知道在ReactInstanceManager执行createReactContext()时
创建了JavaScriptModuleRegistry与NativeModuleRegistry这两张表，我们跟踪一下它们俩的创建流程，以及创建完成后各自的去向。

通过上面分析我们可知JavaScriptModuleRegistry创建完成后由CatalystInstanceImpl实例所持有，供后续Java调用JS时使用。相当于Java层此时持有了一张JS模块表，它以后可以通过这个表去调用JS。
而NativeModuleRegistry在CatalystInstanceImpl.initializeBridge()方法中被传入C++层，最终可以被JS层所拿到。

```java
public class CatalystInstanceImpl(
  private CatalystInstanceImpl(
      final ReactQueueConfigurationSpec ReactQueueConfigurationSpec,
      final JavaScriptExecutor jsExecutor,
      final NativeModuleRegistry registry,
      final JavaScriptModuleRegistry jsModuleRegistry,
      final JSBundleLoader jsBundleLoader,
      NativeModuleCallExceptionHandler nativeModuleCallExceptionHandler) {

    ...

    initializeBridge(
      new BridgeCallback(this),
      jsExecutor,
      mReactQueueConfiguration.getJSQueueThread(),
      mReactQueueConfiguration.getNativeModulesQueueThread(),
      mJavaRegistry.getJavaModules(this),//传入的是Collection<JavaModuleWrapper> ，JavaModuleWrapper是NativeHolder的一个Wrapper类，它对应了C++层JavaModuleWrapper.cpp.
      mJavaRegistry.getCxxModules());//传入的是Collection<ModuleHolder> ，ModuleHolder是NativeModule的一个Holder类，可以实现NativeModule的懒加载。
    FLog.w(ReactConstants.TAG, "Initializing React Xplat Bridge after initializeBridge");
    mMainExecutorToken = getMainExecutorToken();
  }
)
```

这里我们注意一下传入C++的两个集合

```
mJavaRegistry.getJavaModules(this)：传入的是Collection<JavaModuleWrapper> ，JavaModuleWrapper是NativeHolder的一个Wrapper类，它对应了C++层JavaModuleWrapper.cpp，
JS在Java的时候最终会调用到这个类的inovke()方法上。

mJavaRegistry.getCxxModules())：传入的是Collection<ModuleHolder> ，ModuleHolder是NativeModule的一个Holder类，可以实现NativeModule的懒加载。
```
我们继续跟踪这两个集合到了C++层之后的去向。

**CatalystInstanceImpl.cpp**

```c++
void CatalystInstanceImpl::initializeBridge(
    jni::alias_ref<ReactCallback::javaobject> callback,
    // This executor is actually a factory holder.
    JavaScriptExecutorHolder* jseh,
    jni::alias_ref<JavaMessageQueueThread::javaobject> jsQueue,
    jni::alias_ref<JavaMessageQueueThread::javaobject> moduleQueue,
    jni::alias_ref<jni::JCollection<JavaModuleWrapper::javaobject>::javaobject> javaModules,
    jni::alias_ref<jni::JCollection<ModuleHolder::javaobject>::javaobject> cxxModules) {


  instance_->initializeBridge(folly::make_unique<JInstanceCallback>(callback),
                              jseh->getExecutorFactory(),
                              folly::make_unique<JMessageQueueThread>(jsQueue),
                              folly::make_unique<JMessageQueueThread>(moduleQueue),
                              buildModuleRegistry(std::weak_ptr<Instance>(instance_),
                                                  javaModules, cxxModules));
}
```

这两个集合在CatalystInstanceImpl::initializeBridge()被打包成ModuleRegistry传入Instance.cpp.、，如下所示：

**ModuleRegistryBuilder.cpp**

```c++
std::unique_ptr<ModuleRegistry> buildModuleRegistry(
    std::weak_ptr<Instance> winstance,
    jni::alias_ref<jni::JCollection<JavaModuleWrapper::javaobject>::javaobject> javaModules,
    jni::alias_ref<jni::JCollection<ModuleHolder::javaobject>::javaobject> cxxModules) {

  std::vector<std::unique_ptr<NativeModule>> modules;
  for (const auto& jm : *javaModules) {
    modules.emplace_back(folly::make_unique<JavaNativeModule>(winstance, jm));
  }
  for (const auto& cm : *cxxModules) {
    modules.emplace_back(
      folly::make_unique<CxxNativeModule>(winstance, cm->getName(), cm->getProvider()));
  }
  if (modules.empty()) {
    return nullptr;
  } else {
    return folly::make_unique<ModuleRegistry>(std::move(modules));
  }
}
```

打包好的ModuleRegistry通过Instance::initializeBridge()传入到NativeToJsBridge.cpp中，并在NativeToJsBridge的构造方法中传给JsToNativeBridge，以后JS如果调用Java就可以通过
ModuleRegistry来进行调用。


## 二 通信桥的实现

关于整个RN的通信机制，可以用一句话来概括：

>JNI作为C++与Java的桥梁，JSC作为C++与JavaScript的桥梁，而C++最终连接了Java与JavaScript。

### 关于通信桥在Java层中的实现

从文章[ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：启动流程.md)我们得知在

在CatalystInstanceImpl构造方法中做了初始化通信桥的操作：
```java
public class CatalystInstanceImpl implements CatalystInstance {

private CatalystInstanceImpl(
      final ReactQueueConfigurationSpec ReactQueueConfigurationSpec,
      final JavaScriptExecutor jsExecutor,
      final NativeModuleRegistry registry,
      final JavaScriptModuleRegistry jsModuleRegistry,
      final JSBundleLoader jsBundleLoader,
      NativeModuleCallExceptionHandler nativeModuleCallExceptionHandler) {

    ...

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
  
  //在C++层初始化通信桥ReactBridge
  private native void initializeBridge(
      ReactCallback callback,
      JavaScriptExecutor jsExecutor,
      MessageQueueThread jsQueue,
      MessageQueueThread moduleQueue,
      Collection<JavaModuleWrapper> javaModules,
      Collection<ModuleHolder> cxxModules);
}
```
传入的几个参数：

```
ReactCallback callback：CatalystInstanceImpl的静态内部类ReactCallback，负责接口回调。
JavaScriptExecutor jsExecutor：JS执行器，将JS的调用传递给C++层。
MessageQueueThread jsQueue.getJSQueueThread()：JS线程，通过mReactQueueConfiguration.getJSQueueThread()获得，mReactQueueConfiguration通过ReactQueueConfigurationSpec.createDefault()创建。
MessageQueueThread moduleQueue：Native线程，通过mReactQueueConfiguration.getNativeModulesQueueThread()获得，mReactQueueConfiguration通过ReactQueueConfigurationSpec.createDefault()创建。
Collection<JavaModuleWrapper> javaModules：java modules，来源于mJavaRegistry.getJavaModules(this)。
Collection<ModuleHolder> cxxModules)：c++ modules，来源于mJavaRegistry.getCxxModules()。
```

我们去跟踪它的函数调用链：

```
CatalystInstanceImpl.initializeBridge() -> CatalystInstanceImpl::initializeBridge() -> Instance::initializeBridge（）
```

最终可以发现，Instance::initializeBridge（）实现了ReactBridge（C++层对应JsToNativeBridge与NativeToJsBridge）的初始化。

**Instance.cpp**

```
void Instance::initializeBridge(
    std::unique_ptr<InstanceCallback> callback,
    std::shared_ptr<JSExecutorFactory> jsef,
    std::shared_ptr<MessageQueueThread> jsQueue,
    std::unique_ptr<MessageQueueThread> nativeQueue,
    std::shared_ptr<ModuleRegistry> moduleRegistry) {
  callback_ = std::move(callback);

  if (!nativeQueue) {
    // TODO pass down a thread/queue from java, instead of creating our own.

    auto queue = folly::make_unique<CxxMessageQueue>();
    std::thread t(queue->getUnregisteredRunLoop());
    t.detach();
    nativeQueue = std::move(queue);
  }

  jsQueue->runOnQueueSync(
    [this, &jsef, moduleRegistry, jsQueue,
     nativeQueue=folly::makeMoveWrapper(std::move(nativeQueue))] () mutable {
      //初始化NativeToJsBridge对象
      nativeToJsBridge_ = folly::make_unique<NativeToJsBridge>(
          jsef.get(), moduleRegistry, jsQueue, nativeQueue.move(), callback_);

      std::lock_guard<std::mutex> lock(m_syncMutex);
      m_syncReady = true;
      m_syncCV.notify_all();
    });

  CHECK(nativeToJsBridge_);
}
```

我们接着去C++层看看JsToNativeBridge与NativeToJsBridge的实现。

### 关于通信桥在C++层的实现

在C++层的Executor.h文件中定义了整个Java调用JS，JS调用Java的逻辑。

Executor.h文件中定义了抽象类ExecutorDelegate，定义了执行Native Module的方法，它是JS调用Java的桥梁，JsToNativeBridge实现了该类的纯虚函数（抽象方法），该抽象
类还持有JSExecutor（用来执行JS）的引用。

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/6/UMLClassDiagram-ExecutorDelegate.png"/>

```c==
class ExecutorDelegate {
 public:
  virtual ~ExecutorDelegate() {}

  virtual void registerExecutor(std::unique_ptr<JSExecutor> executor,
                                std::shared_ptr<MessageQueueThread> queue) = 0;
  virtual std::unique_ptr<JSExecutor> unregisterExecutor(JSExecutor& executor) = 0;

  virtual std::shared_ptr<ModuleRegistry> getModuleRegistry() = 0;

  virtual void callNativeModules(
    JSExecutor& executor, folly::dynamic&& calls, bool isEndOfBatch) = 0;
  virtual MethodCallResult callSerializableNativeHook(
    JSExecutor& executor, unsigned int moduleId, unsigned int methodId, folly::dynamic&& args) = 0;
};
```

Executor.h文件中定义了抽象类JSExecutor，它定义了执行JS Module的方法，用来解释执行JS，JSCExecutor实现了该类中的纯虚函数（抽象方法），另一个类
NativeToBridge与JsToNativeBridge相对应，它是Java调用JS的桥梁，NativeToBridge持有JSCExecutor的引用，如果NativeToBridge需要执行JS时就会
去调用JSCExecutor。

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/6/UMLClassDiagram-JSExecutor.png"/>

```c++

class JSExecutor {
public:
  /**
   * Execute an application script bundle in the JS context.
   */
  virtual void loadApplicationScript(std::unique_ptr<const JSBigString> script,
                                     std::string sourceURL) = 0;

  /**
   * Add an application "unbundle" file
   */
  virtual void setJSModulesUnbundle(std::unique_ptr<JSModulesUnbundle> bundle) = 0;

  /**
   * Executes BatchedBridge.callFunctionReturnFlushedQueue with the module ID,
   * method ID and optional additional arguments in JS. The executor is responsible
   * for using Bridge->callNativeModules to invoke any necessary native modules methods.
   */
  virtual void callFunction(const std::string& moduleId, const std::string& methodId, const folly::dynamic& arguments) = 0;

  /**
   * Executes BatchedBridge.invokeCallbackAndReturnFlushedQueue with the cbID,
   * and optional additional arguments in JS and returns the next queue. The executor
   * is responsible for using Bridge->callNativeModules to invoke any necessary
   * native modules methods.
   */
  virtual void invokeCallback(const double callbackId, const folly::dynamic& arguments) = 0;

  virtual void setGlobalVariable(std::string propName,
                                 std::unique_ptr<const JSBigString> jsonValue) = 0;
  virtual void* getJavaScriptContext() {
    return nullptr;
  }
  virtual bool supportsProfiling() {
    return false;
  }
  virtual void startProfiler(const std::string &titleString) {}
  virtual void stopProfiler(const std::string &titleString, const std::string &filename) {}
  virtual void handleMemoryPressureUiHidden() {}
  virtual void handleMemoryPressureModerate() {}
  virtual void handleMemoryPressureCritical() {
    handleMemoryPressureModerate();
  }
  virtual void destroy() {}
  virtual ~JSExecutor() {}
};
```


### 关于通信桥在JS层的实现

JS层Libraries/BatchedBridge包下面有3个JS文件：BatchedBridge.js、MessageQueue.js、NativeModules.js，它们封装了通信桥在JS层的实现。

### BatchedBridge.js

```JavaScript
'use strict';

const MessageQueue = require('MessageQueue');
const BatchedBridge = new MessageQueue();

// Wire up the batched bridge on the global object so that we can call into it.
// Ideally, this would be the inverse relationship. I.e. the native environment
// provides this global directly with its script embedded. Then this module
// would export it. A possible fix would be to trim the dependencies in
// MessageQueue to its minimal features and embed that in the native runtime.

Object.defineProperty(global, '__fbBatchedBridge', {
  configurable: true,
  value: BatchedBridge,
});

module.exports = BatchedBridge;
```
可以看到在BatchedBridge中创建了MessageQueue对象。

### MessageQueue.js

MessageQueue的实现有点长，我们来一步步看它的实现。先看MessageQueue的构造方法。

```JavaScript
class MessageQueue {

  //
  _callableModules: {[key: string]: Object};
  //队列，分别存放要调用的模块数组、方法数组、参数数组与数组大小
  _queue: [Array<number>, Array<number>, Array<any>, number];
  //回调函数数组，与_quueue一一对应，每个_queue中调用的方法，如果有回调方法，那么就在这个数组对应的下标上。
  _callbacks: [];
  //回调ID，自动增加。
  _callbackID: number;
  //调用函数ID，自动增加。
  _callID: number;
  _lastFlush: number;
  //消息队列事件循环开始时间
  _eventLoopStartTime: number;

  _debugInfo: Object;
  //Module Table，用于Native Module
  _remoteModuleTable: Object;
  //Method Table，用于Native Module
  _remoteMethodTable: Object;

  __spy: ?(data: SpyData) => void;

  constructor() {
    this._callableModules = {};
    this._queue = [[], [], [], 0];
    this._callbacks = [];
    this._callbackID = 0;
    this._callID = 0;
    this._lastFlush = 0;
    this._eventLoopStartTime = new Date().getTime();

    if (__DEV__) {
      this._debugInfo = {};
      this._remoteModuleTable = {};
      this._remoteMethodTable = {};
    }

    //绑定函数，也就是创建一个函数，使这个函数不论怎么调用都有同样的this值。
    (this:any).callFunctionReturnFlushedQueue = this.callFunctionReturnFlushedQueue.bind(this);
    (this:any).callFunctionReturnResultAndFlushedQueue = this.callFunctionReturnResultAndFlushedQueue.bind(this);
    (this:any).flushedQueue = this.flushedQueue.bind(this);
    (this:any).invokeCallbackAndReturnFlushedQueue = this.invokeCallbackAndReturnFlushedQueue.bind(this);
  }
}
```

```JavaScript

```


### NativeModules.jS

> NativeModules描述了Module的结构，用于解析并生成Module。

Module的结构定义如下所示：

```JavaScript
type ModuleConfig = [
  string, /* name */
  ?Object, /* constants */
  Array<string>, /* functions */
  Array<number>, /* promise method IDs */
  Array<number>, /* sync method IDs */
];
```
举例

```JavaScript
{
  "remoteModuleConfig": {
    "Logger": {
      "constants": { /* If we had exported constants... */ },
      "moduleID": 1,
      "methods": {
        "requestPermissions": {
          "type": "remote",
          "methodID": 1
        }
      }
    }
  }
}
{
  'ToastAndroid': {
    moduleId: 0,
    methods: {
      'show': {
        methodID: 0
      }
    },
    constants: {
      'SHORT': '0',
      'LONG': '1'
    }
  },
  'moduleB': {
    moduleId: 0,
    methods: {
      'method1': {
        methodID: 0
      }
    },
    'key1': 'value1',
    'key2': 'value2'
  }
}

```

```JavaScript

```



## 四 Java层调用JS层

RN应用通信机制流程图（Java->JS）如下所示：

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/6/react_native_communication_mechanism_java_to_js_flow.png"/>

**举例**

在文章[ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：启动流程.md)中，我们在ReactInstanceManager.onAttachedToReactInstance()方法中调用APPRegistry.jS的runApplication()来
启动RN应用，这就是一个典型的Java层调用JS层的例子，我们来具体分析一下这个例子的实现方式。

1 首先定义了接口AppRegistry，该接口继承于JavaScriptModule，如下所示：

```java
/**
 * JS module interface - main entry point for launching React application for a given key.
 */
public interface AppRegistry extends JavaScriptModule {

  void runApplication(String appKey, WritableMap appParameters);
  void unmountApplicationComponentAtRootTag(int rootNodeTag);
  void startHeadlessTask(int taskId, String taskKey, WritableMap data);
}

```

2 然后在CoreModulesPackage.createJSModules()将它添加到JavaScriptModule列表中，这个列表最终会被添加到JavaScriptModuleRegistry中。

```java
class CoreModulesPackage extends LazyReactPackage implements ReactPackageLogger {

  @Override
  public List<Class<? extends JavaScriptModule>> createJSModules() {
    List<Class<? extends JavaScriptModule>> jsModules = new ArrayList<>(Arrays.asList(
        DeviceEventManagerModule.RCTDeviceEventEmitter.class,
        JSTimersExecution.class,
        RCTEventEmitter.class,
        RCTNativeAppEventEmitter.class,
        AppRegistry.class,
        com.facebook.react.bridge.Systrace.class,
        HMRClient.class));

    if (ReactBuildConfig.DEBUG) {
      jsModules.add(DebugComponentOwnershipModule.RCTDebugComponentOwnership.class);
      jsModules.add(JSCHeapCapture.HeapCapture.class);
      jsModules.add(JSCSamplingProfiler.SamplingProfiler.class);
    }

    return jsModules;
  }
}
```

3 通过Java层调用AppRegistry.js的runApplication()方法，如下所示：

```java
//启动流程入口：由Java层调用启动
catalystInstance.getJSModule(AppRegistry.class).runApplication(jsAppModuleName, appParams);
```

### 实现概要

Java层

```
1 把要实现的功能编写成接口并继承JavaScriptModule，并交由ReactPackage管理，最终会在RN初始化的时候添加到JavaScriptModuleRegistry注册表中。
2 通过ReactContext或者CatalystInstanceImpl获取JavaScriptModule，它们最终会通过JavaScriptModuleRegistry.getJavaScriptModule()获取对应的JavaScriptModule。
3 JavaScriptModuleRegistry通过动态代理生成对应的JavaScriptModule，然后通过invoke()调用相应的JS方法，该方法会进一步去调用CatalystInstanceImpl.callJSFunction()
该方法会调用native方法CatalystInstanceImpl.jniCallJSFunction()方法将相关参数传递到C++层，至此，整个流程便转入C++层。

```

C++层

```
4 CatalystInstanceImpl在C++层对应的是类CatalystInstanceImpl.cpp。CatalystInstanceImpl.cpp是RN针对Android平台的包装类，具体功能由Instance.cpp来完成，
即Instance.cpp的callJSFunction()方法。
5 Instance.cpp的callJSFunction()方法按照调用链：Instance.callJSFunction()->NativeToJsBridge.callFunction()->JSCExecutor.callFunction()最终将
功能交由JSCExecutor.cpp的callFunction()方法来完成。
6 JSCExecutor.cpp的callFunction()方法通过Webkit JSC调用JS层的MessageQueue.js里的callFunctionReturnFlushedQueue()方法，自此整个流程转入JavaScript层。
```

JS层

```
7 MessageQueue.js里的callFunctionReturnFlushedQueue()方法，该方法按照调用链：MessageQueue.callFunctionReturnFlushedQueue()->MessageQueue.__callFunction()
在JS层里的JavaScriptModule注册表里产找对应的JavaScriptModule及方法。
```

我们来分析上述代码的调用方式。

可以看出AppRegistry继承于JavaScriptModule，AppRegistry作为核心逻辑之一被添加到CoreModulesPackage中，我们知道在ReactInstanceManager.createReactContext()方法
中，CoreModulesPackage作为ReactPackage被添加进了JavaScriptModuleRegistry中，JavaScriptModuleRegistry被CatalystInstanceImpl来管理。

所以才有了Java层调用JS层代码的通用格式：

```
CatalystInstanceImpl.getJSModule(xxx.class).method(params, params, ...);
```

当然，如果使我们调用自己的JS Module，我们是用ReactContext.getJSModule()，因为ReactContext持有CatalystInstanceImpl的实例，CatalystInstanceImpl并不直接对外公开。

### 实现细节

Java层代码调用JS层代码，需要将JavaScriptModule注册到JavaScriptModuleRegistry中，然后通过动态代理获取方法的各种参数，再将参数通过参数通过C++层传递到JS层从而完成调用，我们
先来看看CatalystInstanceImpl是如何拿到JavaScriptModule的。

CatalystInstanceImpl.getJSModule()调用JavaScriptModuleRegistry.getJavaScriptModule()去查询JavaScriptModule。

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/next_java.png"/>

#### 1 JavaScriptModuleRegistry.getJavaScriptModule(CatalystInstance instance, ExecutorToken executorToken, Class<T> moduleInterface)

它的实现如下所示：

```java
public class JavaScriptModuleRegistry {

  public synchronized <T extends JavaScriptModule> T getJavaScriptModule(
    CatalystInstance instance,
    ExecutorToken executorToken,
    Class<T> moduleInterface) {

    //如果JavaScriptModule加载一次，就保存在缓存中，第二次加载时直接从缓存中取。
    HashMap<Class<? extends JavaScriptModule>, JavaScriptModule> instancesForContext =
        mModuleInstances.get(executorToken);
    if (instancesForContext == null) {
      instancesForContext = new HashMap<>();
      mModuleInstances.put(executorToken, instancesForContext);
    }
    JavaScriptModule module = instancesForContext.get(moduleInterface);
    if (module != null) {
      return (T) module;
    }

    //利用动态代理获取JavaScriptModule对象

    //JavaScriptModuleRegistration是对JavaScriptModule的包装，检查实现JavaScriptModule接口的类是否存在重载，因为JS不支持重载。
    JavaScriptModuleRegistration registration =
        Assertions.assertNotNull(
            mModuleRegistrations.get(moduleInterface),
            "JS module " + moduleInterface.getSimpleName() + " hasn't been registered!");
    JavaScriptModule interfaceProxy = (JavaScriptModule) Proxy.newProxyInstance(
        moduleInterface.getClassLoader(),
        new Class[]{moduleInterface},
        new JavaScriptModuleInvocationHandler(executorToken, instance, registration));
    instancesForContext.put(moduleInterface, interfaceProxy);
    return (T) interfaceProxy;
  }

  private static class JavaScriptModuleInvocationHandler implements InvocationHandler {

    private final WeakReference<ExecutorToken> mExecutorToken;
    private final CatalystInstance mCatalystInstance;
    private final JavaScriptModuleRegistration mModuleRegistration;

    public JavaScriptModuleInvocationHandler(
        ExecutorToken executorToken,
        CatalystInstance catalystInstance,
        JavaScriptModuleRegistration moduleRegistration) {
      mExecutorToken = new WeakReference<>(executorToken);
      mCatalystInstance = catalystInstance;
      mModuleRegistration = moduleRegistration;
    }

    @Override
    public @Nullable Object invoke(Object proxy, Method method, @Nullable Object[] args) throws Throwable {
      ExecutorToken executorToken = mExecutorToken.get();
      if (executorToken == null) {
        FLog.w(ReactConstants.TAG, "Dropping JS call, ExecutorToken went away...");
        return null;
      }
      NativeArray jsArgs = args != null ? Arguments.fromJavaArgs(args) : new WritableNativeArray();
      //调用CatalystInstanceImpl.callFunction()方法。
      mCatalystInstance.callFunction()方法。(
        executorToken,
        mModuleRegistration.getName(),
        method.getName(),
        jsArgs
      );
      return null;
    }
  }
}
```

可以看出，在JavaScriptModuleRegistry通过动态代理的方式获取JavaScriptModule，对Java动态代理不熟悉的同学，这里我们先简单回忆一下Java动态代理相关内容。

**Java动态代理**

```
Java动态代理主要涉及两个类：

java.lang.reflect.Proxy：用来生成代理类。
java.lang.reflect.InvocationHandler：调用处理器，我们需要自己定义一个类来指定动态生成的代理类需要完成的具体内容。

Proxy的主要方法：

static Object newProxyInstance(ClassLoader loader, Class<?>[] interfaces, InvocationHandler handler)//创建代理对象  

ClassLoader loader：类加载器，指定使用哪个类加载器将代理类加载到JVM的方法区。
Class<?>[] interfaces：代理类需要实现的接口。
InvocationHandler handler：调用处理器实例，指定代理类具体要做什么。

实现Java动态代理需要以下3步：

1 定义一个委托类和公共接口。
2 定义调用处理器类实现InvocationHandler接口，指定代理类具体要完成的任务。
3 生成代理对象

一个代理对象对应一个委托类对应一个调用处理器类

```

JavaScriptModuleInvocationHandler.invoke()方法获取了moduleID，methodID，并去调用CatalystInstanceImpl.callFunction();

#### 2 CatalystInstanceImpl.callFunction(ExecutorToken executorToken, final String module, final String method, final NativeArray arguments)

```java

public class CatalystInstanceImpl{

  @Override
  public void callFunction(
      ExecutorToken executorToken,
      final String module,
      final String method,
      final NativeArray arguments) {
    if (mDestroyed) {
      FLog.w(ReactConstants.TAG, "Calling JS function after bridge has been destroyed.");
      return;
    }
    if (!mAcceptCalls) {
      // Most of the time the instance is initialized and we don't need to acquire the lock
      synchronized (mJSCallsPendingInitLock) {
        if (!mAcceptCalls) {
          mJSCallsPendingInit.add(new PendingJSCall(executorToken, module, method, arguments));
          return;
        }
      }
    }

    jniCallJSFunction(executorToken, module, method, arguments);
  }

  private native void jniCallJSCallback(ExecutorToken executorToken, int callbackID, NativeArray arguments);
}
```

方法走到这里，实现逻辑已经由Java层转到C++层，我们去C++层看看具体的实现。

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/next_c++.png"/>

### 实现细节（C++层）

CatalystInstanceImpl.java在C++层有个对应的类CatalystInstanceImpl.cpp。


#### 3 CatalystInstanceImpl.jniCallJSFunction(JExecutorToken* token, std::string module, std::string method, NativeArray* arguments)

**CatalystInstanceImpl.cpp**

```c++
void CatalystInstanceImpl::jniCallJSFunction(

    JExecutorToken* token, std::string module, std::string method, NativeArray* arguments) {
  // We want to share the C++ code, and on iOS, modules pass module/method
  // names as strings all the way through to JS, and there's no way to do
  // string -> id mapping on the objc side.  So on Android, we convert the
  // number to a string, here which gets passed as-is to JS.  There, they they
  // used as ids if isFinite(), which handles this case, and looked up as
  // strings otherwise.  Eventually, we'll probably want to modify the stack
  // from the JS proxy through here to use strings, too.
  instance_->callJSFunction(token->getExecutorToken(nullptr),
                            std::move(module),
                            std::move(method),
                            arguments->consume());
}

```

可以发现CatalystInstanceImpl.cpp的jniCallJSFunction()方法又会去调用Instance.cpp里的callJSFunction()方法，其实CatalystInstanceImpl.cpp只是RN针对
Android平台适配的封装，主要做了写参数类型转换，本质上它对应了ReactCommon包里的Instance.cpp，真正的实现在Instance.cpp中完成。我们来看一看Instance.cpp中的实现。

#### 4 Instance.callJSFunction(ExecutorToken token, std::string&& module, std::string&& method, folly::dynamic&& params)

**Instance.cpp**

```c++
void Instance::callJSFunction(ExecutorToken token, std::string&& module, std::string&& method,
                              folly::dynamic&& params) {
  callback_->incrementPendingJSCalls();
  nativeToJsBridge_->callFunction(token, std::move(module), std::move(method), std::move(params));
}
```

Instance.cpp的callJSFunction()进一步去调用NativeToJsBridge.cpp的callFunction()方法，我们来看看它的实现。

#### 5 NativeToJsBridge.callFunction(ExecutorToken executorToken, std::string&& module, std::string&& method, folly::dynamic&& arguments)

**NativeToJsBridge.cpp**

```c++
void NativeToJsBridge::callFunction(
    ExecutorToken executorToken,
    std::string&& module,
    std::string&& method,
    folly::dynamic&& arguments) {

  int systraceCookie = -1;
  #ifdef WITH_FBSYSTRACE
  systraceCookie = m_systraceCookie++;
  std::string tracingName = fbsystrace_is_tracing(TRACE_TAG_REACT_CXX_BRIDGE) ?
    folly::to<std::string>("JSCall__", module, '_', method) : std::string();
  SystraceSection s(tracingName.c_str());
  FbSystraceAsyncFlow::begin(
      TRACE_TAG_REACT_CXX_BRIDGE,
      tracingName.c_str(),
      systraceCookie);
  #else
  std::string tracingName;
  #endif

  runOnExecutorQueue(executorToken, [module = std::move(module), method = std::move(method), arguments = std::move(arguments), tracingName = std::move(tracingName), systraceCookie] (JSExecutor* executor) {
    #ifdef WITH_FBSYSTRACE
    FbSystraceAsyncFlow::end(
        TRACE_TAG_REACT_CXX_BRIDGE,
        tracingName.c_str(),
        systraceCookie);
    SystraceSection s(tracingName.c_str());
    #endif

    //调用JSCExecutor.cppd的callFunction()
    // This is safe because we are running on the executor's thread: it won't
    // destruct until after it's been unregistered (which we check above) and
    // that will happen on this thread
    executor->callFunction(module, method, arguments);
  });
}
```
NativeToJsBridge.cpp的callFunction()进一步去调用JSCExecutor.cppd的callFunction()方法，我们来看看它的实现。

#### 6 JSCExecutor.callFunction(const std::string& moduleId, const std::string& methodId, const folly::dynamic& arguments)

**JSCExecutor.cpp**

```c++
void JSCExecutor::callFunction(const std::string& moduleId, const std::string& methodId, const folly::dynamic& arguments) {
  SystraceSection s("JSCExecutor::callFunction");
  // This weird pattern is because Value is not default constructible.
  // The lambda is inlined, so there's no overhead.

  auto result = [&] {
    try {
      // See flush()
      CHECK(m_callFunctionReturnFlushedQueueJS)
        << "Attempting to call native methods without loading BatchedBridge.js";
      return m_callFunctionReturnFlushedQueueJS->callAsFunction({
        Value(m_context, String::createExpectingAscii(m_context, moduleId)),
        Value(m_context, String::createExpectingAscii(m_context, methodId)),
        Value::fromDynamic(m_context, std::move(arguments))
      });
    } catch (...) {
      std::throw_with_nested(
        std::runtime_error("Error calling " + moduleId + "." + methodId));
    }
  }();

  //将调用结果返回给Java层
  callNativeModules(std::move(result));
}

```

可以看出，该函数进一步调用m_callFunctionReturnFlushedQueueJS->callAsFunction()，我们先来解释下m_callFunctionReturnFlushedQueueJS这个变量的由来，它在JSCExecutor::bindBridge()里
初始化，本质上就是通过Webkit JSC拿到JS层代码相关对象和方法引用，m_callFunctionReturnFlushedQueueJS就是MessageQueue.js里的callFunctionReturnFlushedQueue()方法的引用。

```c++
void JSCExecutor::bindBridge() throw(JSException) {

  ...

 m_callFunctionReturnFlushedQueueJS = batchedBridge.getProperty("callFunctionReturnFlushedQueue").asObject();

  ...
}
```

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/next_js.png"/>

#### 7 MessageQueue.callFunctionReturnFlushedQueue(module: string, method: string, args: Array<any>)

MessageQueue.callFunctionReturnFlushedQueue()方法的实现如下所示：

**MessageQueue.js**

```javascript
  callFunctionReturnFlushedQueue(module: string, method: string, args: Array<any>) {
    guard(() => {
      this.__callFunction(module, method, args);
      this.__callImmediates();
    });

    return this.flushedQueue();
  }

  __callFunction(module: string, method: string, args: Array<any>) {
    this._lastFlush = new Date().getTime();
    this._eventLoopStartTime = this._lastFlush;
    Systrace.beginEvent(`${module}.${method}()`);
    if (this.__spy) {
      this.__spy({ type: TO_JS, module, method, args});
    }

    //从JS层的JavaScriptModule注册表中查找到AppRegistry.js
    const moduleMethods = this._callableModules[module];
    invariant(
      !!moduleMethods,
      'Module %s is not a registered callable module (calling %s)',
      module, method
    );
    invariant(
      !!moduleMethods[method],
      'Method %s does not exist on module %s',
      method, module
    );
    //取到Java层调用的JS层方法，例如：AppRegistry.js的runApplication()方法
    const result = moduleMethods[method].apply(moduleMethods, args);
    Systrace.endEvent();
    return result;
  }
```

从JS层的JavaScriptModule注册表中查找到AppRegistry.js，最终调用AppRegistry.js的runApplication()方法。

好，以上就是Java层代码调用JS层代码的全部流程，我们再来总结一下：

Java层

```
1 把要实现的功能编写成接口并继承JavaScriptModule，并交由ReactPackage管理，最终会在RN初始化的时候添加到JavaScriptModuleRegistry注册表中。
2 通过ReactContext或者CatalystInstanceImpl获取JavaScriptModule，它们最终会通过JavaScriptModuleRegistry.getJavaScriptModule()获取对应的JavaScriptModule。
3 JavaScriptModuleRegistry通过动态代理生成对应的JavaScriptModule，然后通过invoke()调用相应的JS方法，该方法会进一步去调用CatalystInstanceImpl.callJSFunction()
该方法会调用native方法CatalystInstanceImpl.jniCallJSFunction()方法将相关参数传递到C++层，至此，整个流程便转入C++层。

```

C++层

```
4 CatalystInstanceImpl在C++层对应的是类CatalystInstanceImpl.cpp。CatalystInstanceImpl.cpp是RN针对Android平台的包装类，具体功能由Instance.cpp来完成，
即Instance.cpp的callJSFunction()方法。
5 Instance.cpp的callJSFunction()方法按照调用链：Instance.callJSFunction()->NativeToJsBridge.callFunction()->JSCExecutor.callFunction()最终将
功能交由JSCExecutor.cpp的callFunction()方法来完成。
6 JSCExecutor.cpp的callFunction()方法通过Webkit JSC调用JS层的MessageQueue.js里的callFunctionReturnFlushedQueue()方法，自此整个流程转入JavaScript层。
```

JavaScript层

```
7 MessageQueue.js里的callFunctionReturnFlushedQueue()方法，该方法按照调用链：MessageQueue.callFunctionReturnFlushedQueue()->MessageQueue.__callFunction()
在JS层里的JavaScriptModule注册表里产找对应的JavaScriptModule及方法。
```

接下来，我们分析一下JS代码调用Java代码的流程。

## 三 JS层调用Java层

RN应用通信机制流程图（JS->Java）如下所示：

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/6/react_native_communication_mechanism_js_to_java_flow.png"/>

**举例**

同样的，我们先来看一个JS代码调用Java代码的例子，我们写一个ToastModule供JS代码调用。

1 编写ToastModule继承于ReactContextBaseJavaModule，该ToastModule实现具体的功能供JS代码调用。

```java
public class ToastModule extends ReactContextBaseJavaModule {

  private static final String DURATION_SHORT_KEY = "SHORT";
  private static final String DURATION_LONG_KEY = "LONG";

  public ToastModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  //返回模块名字供JS代码调用
  @Override
  public String getName() {
    return "ToastAndroid";
  }

  //返回常量供JS代码调用
  @Override
  public Map<String, Object> getConstants() {
    final Map<String, Object> constants = new HashMap<>();
    constants.put(DURATION_SHORT_KEY, Toast.LENGTH_SHORT);
    constants.put(DURATION_LONG_KEY, Toast.LENGTH_LONG);
    return constants;
  }

  //暴露给JS代码的方法，加@ReactMethod注解，且该方法总是void。
  @ReactMethod
  public void show(String message, int duration) {
    Toast.makeText(getReactApplicationContext(), message, duration).show();
  }
}

```

2 编写类继承ReactPackage，注册ToastModule。

```java
public class AnExampleReactPackage implements ReactPackage {

  @Override
  public List<Class<? extends JavaScriptModule>> createJSModules() {
    return Collections.emptyList();
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }

  @Override
  public List<NativeModule> createNativeModules(
                              ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();

    modules.add(new ToastModule(reactContext));

    return modules;
  }

}
```

```java
protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
            new MainReactPackage(),
            new AnExampleReactPackage()); // <-- Add this line with your package name.
}
```

3 为了方便JS代码调用，编写一个JS Module来包装Native Module的功能。

```javascript

'use strict';
/**
 * This exposes the native ToastAndroid module as a JS module. This has a
 * function 'show' which takes the following parameters:
 *
 * 1. String message: A string with the text to toast
 * 2. int duration: The duration of the toast. May be ToastAndroid.SHORT or
 *    ToastAndroid.LONG
 */
import { NativeModules } from 'react-native';
module.exports = NativeModules.ToastAndroid;
```

4 最后我们就可以直接在JS代码中进行调用。

```javascript

import ToastAndroid from './ToastAndroid';

ToastAndroid.show('Awesome', ToastAndroid.SHORT);
```

以上便是JS代码调用Java代码的全部流程，我们来具体分析它的实现细节。

### 实现概要

从上面例子中，我们可以看出，调用的第一步就是从JS层的NativeModule注册表中拿到对应Java层的Java Module。但是JS在调用Java并不是通过接口来进行的，而是对应的
参数moduleID、methodID都push到一个messageQueue中，等待Java层的事件来驱动它，当Java层的事件传递过来以后，JS层把messageQUeue中的所有数据返回到Java层，
再通过注册表JavaRegistry去调用方法。

第一步，我们再调用Java代码时都通过NativeModules.xxxModule.xxxMethod()的方式来调用，我们先来看看NativeModules.js的实现。

### 实现细节（JavaScript层）

#### 1 NativeModules.xxxModule.xxxMethod()

当我们用NativeModules.xxxModule.xxxMethod()这种方式去调用时，JS就会通过JS层的NativeModules去查找相对应的Java Module。

**NativeModules.js**

```javascript

let NativeModules : {[moduleName: string]: Object} = {};
  
  //可以看到Native被赋值为global.nativeModuleProxy，nativeModuleProxy是一个全局变量，顾名思义，它是NativeModules.js在C++层的代理。
  NativeModules = global.nativeModuleProxy;
} else {
  const bridgeConfig = global.__fbBatchedBridgeConfig;
  invariant(bridgeConfig, '__fbBatchedBridgeConfig is not set, cannot invoke native modules');

  (bridgeConfig.remoteModuleConfig || []).forEach((config: ModuleConfig, moduleID: number) => {
    // Initially this config will only contain the module name when running in JSC. The actual
    // configuration of the module will be lazily loaded.
    const info = genModule(config, moduleID);
    if (!info) {
      return;
    }

    if (info.module) {
      NativeModules[info.name] = info.module;
    }
    // If there's no module config, define a lazy getter
    else {
      defineLazyObjectProperty(NativeModules, info.name, {
        get: () => loadModule(info.name, moduleID)
      });
    }
  });
}

module.exports = NativeModules;
```


nativeModuleProxy实质上是在启动流程中，JSCExecutor::JSCExecutor()在创建时通过installGlobalProxy(m_context, "nativeModuleProxy", exceptionWrapMethod<&JSCExecutor::getNativeModule>())
创建的，所以当JS调用NativeModules时，实际上在调用JSCExecutor::getNativeModule()方法，我们来看一看该方法的实现。

#### 2 JSCExecutor::getNativeModule(JSObjectRef object, JSStringRef propertyName)

```c++

JSValueRef JSCExecutor::getNativeModule(JSObjectRef object, JSStringRef propertyName) {
  if (JSC_JSStringIsEqualToUTF8CString(m_context, propertyName, "name")) {
    return Value(m_context, String(m_context, "NativeModules"));
  }
  //m_nativeModules的类型是JSCNativeModules
  return m_nativeModules.getModule(m_context, propertyName);
}
```

该方法进一步调用JSCNativeModules.cpp的getModule()方法，我们来看看它的实现。

#### 3 JSCNativeModules::getModule(JSContextRef context, JSStringRef jsName)

**JSCNativeModules.cpp**

```c++
JSValueRef JSCNativeModules::getModule(JSContextRef context, JSStringRef jsName) {
  if (!m_moduleRegistry) {
    return Value::makeUndefined(context);
  }

  std::string moduleName = String::ref(context, jsName).str();

  const auto it = m_objects.find(moduleName);
  if (it != m_objects.end()) {
    return static_cast<JSObjectRef>(it->second);
  }

  //调用该方法，通过JSC获取全局设置的JS属性，然后通过JNI查找Java层注册表，再触发JS层方法。
  auto module = createModule(moduleName, context);
  if (!module.hasValue()) {
    return Value::makeUndefined(context);
  }

  // Protect since we'll be holding on to this value, even though JS may not
  module->makeProtected();

  auto result = m_objects.emplace(std::move(moduleName), std::move(*module)).first;
  return static_cast<JSObjectRef>(result->second);
}

folly::Optional<Object> JSCNativeModules::createModule(const std::string& name, JSContextRef context) {
  if (!m_genNativeModuleJS) {

    auto global = Object::getGlobalObject(context);
    //NativeModules.js中将全局变量__fbGenNativeModule指向了函数NativeModules::gen()方法，此处
    //便是去获取JSC去调用这个方法
    m_genNativeModuleJS = global.getProperty("__fbGenNativeModule").asObject();
    m_genNativeModuleJS->makeProtected();

    // Initialize the module name list, otherwise getModuleConfig won't work
    // TODO (pieterdb): fix this in ModuleRegistry
    m_moduleRegistry->moduleNames();
  }
  //获取Native配置表
  auto result = m_moduleRegistry->getConfig(name);
  if (!result.hasValue()) {
    return nullptr;
  }

  //调用NativeModules::gen()方法
  Value moduleInfo = m_genNativeModuleJS->callAsFunction({
    Value::fromDynamic(context, result->config),
    Value::makeNumber(context, result->index)
  });
  CHECK(!moduleInfo.isNull()) << "Module returned from genNativeModule is null";

  return moduleInfo.asObject().getProperty("module").asObject();
}

```

上面的方法实现的功能分为2步：

```
1 调用ModuleRegistry::getConfig()获取ModuleConfig。
2 通过JSC调用NativeModules.js的genModule()方法
```

ModuleRegistry是从Java层传递过来额JavaModuleRegistry，ModuleRegistry::getConfig()查询Java Module的配置表，然后发送给NativeModule.js生成对应的JS Module。

**ModuleRegistry.cpp**

```c++
 
folly::Optional<ModuleConfig> ModuleRegistry::getConfig(const std::string& name) {
  SystraceSection s("getConfig", "module", name);
  auto it = modulesByName_.find(name);
  if (it == modulesByName_.end()) {
    return nullptr;
  }

  CHECK(it->second < modules_.size());
  //modules_列表来源于CatalystInstanceImpl::initializeBridge()
  //module实质上是ModuleRegistryHolder.cpp的构造函数汇总将Java层传递过来的Module包装成CxxNativeModule与JavaModule，这两个都是NativeModule的子类。
  NativeModule* module = modules_[it->second].get();

  //string name, object constants, array methodNames准备创建一个动态对象。
  // string name, object constants, array methodNames (methodId is index), [array promiseMethodIds], [array syncMethodIds]
  folly::dynamic config = folly::dynamic::array(name);

  {
    SystraceSection s("getConstants");
    //通过反射调用Java层的JavaModuleWrapper.getContants()shi方法。
    config.push_back(module->getConstants());
  }

  {
    SystraceSection s("getMethods");
    //通过反射调用Java层的JavaModuleWrapper.getMethods()方法，也就是BaseJavaModule.getMethods()，该方法内部会调用
    //findMethos()方法查询带有ReactMoethod注解的方法。
    std::vector<MethodDescriptor> methods = module->getMethods();

    folly::dynamic methodNames = folly::dynamic::array;
    folly::dynamic promiseMethodIds = folly::dynamic::array;
    folly::dynamic syncMethodIds = folly::dynamic::array;

    for (auto& descriptor : methods) {
      // TODO: #10487027 compare tags instead of doing string comparison?
      methodNames.push_back(std::move(descriptor.name));
      if (descriptor.type == "promise") {
        promiseMethodIds.push_back(methodNames.size() - 1);
      } else if (descriptor.type == "sync") {
        syncMethodIds.push_back(methodNames.size() - 1);
      }
    }

    if (!methodNames.empty()) {
      config.push_back(std::move(methodNames));
      if (!promiseMethodIds.empty() || !syncMethodIds.empty()) {
        config.push_back(std::move(promiseMethodIds));
        if (!syncMethodIds.empty()) {
          config.push_back(std::move(syncMethodIds));
        }
      }
    }
  }

  if (config.size() == 1) {
    // no constants or methods
    return nullptr;
  } else {
    return ModuleConfig({it->second, config});
  }
}

```

获取到相应ModuleConfig就会去调用NativeModules.js的genModule()生成JS将要调用对应的JS Module。

#### 4 NativeModules.genModule(config: ?ModuleConfig, moduleID: number): ?{name: string, module?: Object}

**NativeModules.js**

```javascript

// export this method as a global so we can call it from native
global.__fbGenNativeModule = genModule;

function genModule(config: ?ModuleConfig, moduleID: number): ?{name: string, module?: Object} {
  if (!config) {
    return null;
  }

  //通过JSC拿到C++中从Java层获取的Java Module的注册表
  const [moduleName, constants, methods, promiseMethods, syncMethods] = config;
  invariant(!moduleName.startsWith('RCT') && !moduleName.startsWith('RK'),
    'Module name prefixes should\'ve been stripped by the native side ' +
    'but wasn\'t for ' + moduleName);

  if (!constants && !methods) {
    // Module contents will be filled in lazily later
    return { name: moduleName };
  }

  const module = {};
  //遍历构建Module的属性与方法
  methods && methods.forEach((methodName, methodID) => {
    const isPromise = promiseMethods && arrayContains(promiseMethods, methodID);
    const isSync = syncMethods && arrayContains(syncMethods, methodID);
    invariant(!isPromise || !isSync, 'Cannot have a method that is both async and a sync hook');
    const methodType = isPromise ? 'promise' : isSync ? 'sync' : 'async';
    //生成Module的函数方法
    module[methodName] = genMethod(moduleID, methodID, methodType);
  });
  Object.assign(module, constants);

  if (__DEV__) {
    BatchedBridge.createDebugLookup(moduleID, moduleName, methods);
  }

  return { name: moduleName, module };
}

```

该方法通过JSC拿到C++中从Java层获取的Java Module的注册表，遍历构建Module的属性与方法，并调用genMethod()生成Module的函数方法，我们调用ToastAndroid.show(‘Awesome’, ToastAndroid.SHORT)时
实际上就是在调用genMethod()生成的方法，我们来看一看它的实现。

**NativeModules.js**

```javascript
//该函数会根据函数类型的不同做不同的处理，但最终都会调用BatchedBridge.enqueueNativeCall()方法。
function genMethod(moduleID: number, methodID: number, type: MethodType) {
  let fn = null;
  if (type === 'promise') {
    fn = function(...args: Array<any>) {
      return new Promise((resolve, reject) => {
        BatchedBridge.enqueueNativeCall(moduleID, methodID, args,
          (data) => resolve(data),
          (errorData) => reject(createErrorFromErrorData(errorData)));
      });
    };
  } else if (type === 'sync') {
    fn = function(...args: Array<any>) {
      return global.nativeCallSyncHook(moduleID, methodID, args);
    };
  } else {
    fn = function(...args: Array<any>) {
      const lastArg = args.length > 0 ? args[args.length - 1] : null;
      const secondLastArg = args.length > 1 ? args[args.length - 2] : null;
      const hasSuccessCallback = typeof lastArg === 'function';
      const hasErrorCallback = typeof secondLastArg === 'function';
      hasErrorCallback && invariant(
        hasSuccessCallback,
        'Cannot have a non-function arg after a function arg.'
      );
      const onSuccess = hasSuccessCallback ? lastArg : null;
      const onFail = hasErrorCallback ? secondLastArg : null;
      const callbackCount = hasSuccessCallback + hasErrorCallback;
      args = args.slice(0, args.length - callbackCount);
      BatchedBridge.enqueueNativeCall(moduleID, methodID, args, onFail, onSuccess);
    };
  }
  fn.type = type;
  return fn;
}
```
该函数会根据函数类型的不同做不同的处理，但最终都会调用BatchedBridge.enqueueNativeCall()方法，我们来看看它的实现。

#### 5 MessageQueue.enqueueNativeCall(moduleID: number, methodID: number, params: Array<any>, onFail: ?Function, onSucc: ?Function)

**MessageQueue.js**

```javascript

  enqueueNativeCall(moduleID: number, methodID: number, params: Array<any>, onFail: ?Function, onSucc: ?Function) {
    if (onFail || onSucc) {
      if (__DEV__) {
        const callId = this._callbackID >> 1;
        this._debugInfo[callId] = [moduleID, methodID];
        if (callId > DEBUG_INFO_LIMIT) {
          delete this._debugInfo[callId - DEBUG_INFO_LIMIT];
        }
      }
      onFail && params.push(this._callbackID);
      /* $FlowFixMe(>=0.38.0 site=react_native_fb,react_native_oss) - Flow error
       * detected during the deployment of v0.38.0. To see the error, remove
       * this comment and run flow */
      this._callbacks[this._callbackID++] = onFail;
      onSucc && params.push(this._callbackID);
      /* $FlowFixMe(>=0.38.0 site=react_native_fb,react_native_oss) - Flow error
       * detected during the deployment of v0.38.0. To see the error, remove
       * this comment and run flow */
      this._callbacks[this._callbackID++] = onSucc;
    }

    if (__DEV__) {
      global.nativeTraceBeginAsyncFlow &&
        global.nativeTraceBeginAsyncFlow(TRACE_TAG_REACT_APPS, 'native', this._callID);
    }
    this._callID++;

    //_queue是个队列，用来存放调用的模块、方法与参数信息。
    this._queue[MODULE_IDS].push(moduleID);
    this._queue[METHOD_IDS].push(methodID);

    if (__DEV__) {
      // Any params sent over the bridge should be encodable as JSON
      JSON.stringify(params);

      // The params object should not be mutated after being queued
      deepFreezeAndThrowOnMutationInDev((params:any));
    }
    this._queue[PARAMS].push(params);

    const now = new Date().getTime();
    //如果5ms内有多个方法调用则先待在队列里，防止过高频率的方法调用，否则则调用JSCExecutor::nativeFlushQueueImmediate(size_t argumentCount, const JSValueRef arguments[]) 方法。
    if (global.nativeFlushQueueImmediate &&
        now - this._lastFlush >= MIN_TIME_BETWEEN_FLUSHES_MS) {
      global.nativeFlushQueueImmediate(this._queue);
      this._queue = [[], [], [], this._callID];
      this._lastFlush = now;
    }
    Systrace.counterEvent('pending_js_to_native_queue', this._queue[0].length);
    if (__DEV__ && this.__spy && isFinite(moduleID)) {
      this.__spy(
        { type: TO_NATIVE,
          module: this._remoteModuleTable[moduleID],
          method: this._remoteMethodTable[moduleID][methodID],
          args: params }
      );
    } else if (this.__spy) {
      this.__spy({type: TO_NATIVE, module: moduleID + '', method: methodID, args: params});
    }
  }

```

流程走到这个方法的时候，JS层的调用流程就结束了，JS层主要通过JSC桥接获取Java Module的注册表，并把它转换为对应的JS Native Module（属性、方法转换），当JS
通过NativeModule.xxxMethod()准备调用Java方法时，会把xxxMethod()放进一个JS队列，在队列中：

```
1 如果如果5m（MIN_TIME_BETWEEN_FLUSHES_MS）以内，则继续在队列中等待，防止高频率调用。
2 如果5m（MIN_TIME_BETWEEN_FLUSHES_MS）以内，则直接触发的 JSCExecutor::nativeFlushQueueImmediate(size_t argumentCount, const JSValueRef arguments[]) 方法。
```
事实上，在队列中，如果是Java方法调用JS方法，则会把之前队列里存的方法通过JSCExecutor::flush()进行处理。

我们再来看看JSCExecutor::nativeFlushQueueImmediate(size_t argumentCount, const JSValueRef arguments[]) 的实现。

#### 6 JSValueRef JSCExecutor::nativeFlushQueueImmediate(size_t argumentCount, const JSValueRef arguments[])

**JSCExecutor.cpp**

```c++
JSValueRef JSCExecutor::nativeFlushQueueImmediate(
    size_t argumentCount,
    const JSValueRef arguments[]) {
  if (argumentCount != 1) {
    throw std::invalid_argument("Got wrong number of args");
  }

  flushQueueImmediate(Value(m_context, arguments[0]));
  return Value::makeUndefined(m_context);
}

void JSCExecutor::flushQueueImmediate(Value&& queue) {
  auto queueStr = queue.toJSONString();
  //调用JsToNativeBridge.cpp的callNativeModules()，传入的isEndOfBatch=false
  m_delegate->callNativeModules(*this, folly::parseJson(queueStr), false);
}
```
可以看出nativeFlushQueueImmediate()会进一步调用flushQueueImmediate()方法，m_delegate的类型是ExecutorDelegate，事实上它调用的是ExecutorDelegate的子类
JsToNativeBridge.cpp的callNativeModules()方法，我们回想一下上面我们分析Java代码调用JS代码第7步的实现，它也同样走到了这个方法，只是传入的isEndOfBatch=true。

#### 7 JsToNativeBridge::callNativeModules()

**JsToNativeBridge.cpp**

```
  void callNativeModules()(
      JSExecutor& executor, folly::dynamic&& calls, bool isEndOfBatch) override {

    CHECK(m_registry || calls.empty()) <<
      "native module calls cannot be completed with no native modules";
    ExecutorToken token = m_nativeToJs->getTokenForExecutor(executor);
    //在Native队列中执行
    m_nativeQueue->runOnQueue([this, token, calls=std::move(calls), isEndOfBatch] () mutable {

      //遍历来自JS队列的调用方法列表

      // An exception anywhere in here stops processing of the batch.  This
      // was the behavior of the Android bridge, and since exception handling
      // terminates the whole bridge, there's not much point in continuing.
      for (auto& call : react::parseMethodCalls(std::move(calls))) {
        //m_registry的类型是ModuleRegistry，
        m_registry->callNativeMethod(
          token, call.moduleId, call.methodId, std::move(call.arguments), call.callId);
      }
      if (isEndOfBatch) {
        //标记回调Java状态
        m_callback->onBatchComplete();
        m_callback->decrementPendingJSCalls();
      }
    });
  }
```

在该方法中取出JS队列中的JS调用Java的所有方法，并通过ModuleRegistry::callNativeMethod()方法去遍历调用，我们来看看这个方法的实现。

#### 8 ModuleRegistry::callNativeMethod(ExecutorToken token, unsigned int moduleId, unsigned int methodId, folly::dynamic&& params, int callId)

```c++
void ModuleRegistry::callNativeMethod(ExecutorToken token, unsigned int moduleId, unsigned int methodId,
                                      folly::dynamic&& params, int callId) {
  if (moduleId >= modules_.size()) {
    throw std::runtime_error(
      folly::to<std::string>("moduleId ", moduleId,
                             " out of range [0..", modules_.size(), ")"));
  }

#ifdef WITH_FBSYSTRACE
  if (callId != -1) {
    fbsystrace_end_async_flow(TRACE_TAG_REACT_APPS, "native", callId);
  }
#endif
  
  //modules_是创建ModuleRegistryHolder时根据Java层ModuleRegistryHolder创建的C++ NativeModule
  //moduleId为模块在当前列表的索引值
  modules_[moduleId]->invoke(token, methodId, std::move(params));
}

```

modules_的类型是std::vector<std::unique_ptr<NativeModule>> modules_，NativeModule是C++层针对Java Module的一种包装，NativeModule的子类是JavaNativeModule，
我们去看看它的调用方法invoke().

#### 9 JavaNativeModule::invoke(ExecutorToken token, unsigned int reactMethodId, folly::dynamic&& params)

抽象类NativeModule定义的纯虚函数（抽象方法）

**NativeModule.cpp**

```c++
class NativeModule {
 public:
  virtual ~NativeModule() {}
  virtual std::string getName() = 0;
  virtual std::vector<MethodDescriptor> getMethods() = 0;
  virtual folly::dynamic getConstants() = 0;
  virtual bool supportsWebWorkers() = 0;
  // TODO mhorowitz: do we need initialize()/onCatalystInstanceDestroy() in C++
  // or only Java?
  virtual void invoke(ExecutorToken token, unsigned int reactMethodId, folly::dynamic&& params) = 0;
  virtual MethodCallResult callSerializableNativeHook(ExecutorToken token, unsigned int reactMethodId, folly::dynamic&& args) = 0;
};

}
}

```
NativeModule有2个子类，它的类图如下所示：

<img src="https://github.com/guoxiaoxing/react-native-android-container/raw/master/art/source/6/UMLClassDiagram-NativeModule.png"/>

```c++
class JavaNativeModule : public NativeModule {

  void JavaNativeModule::invoke(ExecutorToken token, unsigned int reactMethodId, folly::dynamic&& params) {

  //wrapper_-的类型是JavaModuleWrapper.cpp，映射Java层的JavaModuleWrapper.java，在ModuleRegistryHolder.cpp构造方法中由Java传入的Java Module被C++包装成
  //JavaModuleWrapper对象。通过反射调用Java层的JavaModuleWrapper.java的invoke()方法，同时把mothodId和参数传过去。
  static auto invokeMethod =
    wrapper_->getClass()->getMethod<void(JExecutorToken::javaobject, jint, ReadableNativeArray::javaobject)>("invoke");
  invokeMethod(wrapper_, JExecutorToken::extractJavaPartFromToken(token).get(), static_cast<jint>(reactMethodId),
               ReadableNativeArray::newObjectCxxArgs(std::move(params)).get());
}
}
```

该方法调用通过反射调用Java层的JavaModuleWrapper.java的invoke()方法，同时把mothodId和参数传过去。我们来看看JavaModuleWrapper.java的invoke()方法的实现。

#### 10 JavaModuleWrapper.invoke(ExecutorToken token, int methodId, ReadableNativeArray parameters)

```java

//NativeModules是一个接口，我们知道要实现供JS调用的Java API我们需要编写类继承BaseJavaModule/ReactContextBaseJavaModule，BaseJavaModule/ReactContextBaseJavaModule就
//实现了NativeModule接口，
 private final ArrayList<NativeModule.NativeMethod> mMethods;

@DoNotStrip
public class JavaModuleWrapper {
  @DoNotStrip
  public void invoke(ExecutorToken token, int methodId, ReadableNativeArray parameters) {
    if (mMethods == null || methodId >= mMethods.size()) {
      return;
    }
    //mMethods为所有继承BaseJavaModule类的BaseJavaModule.JavaMethod对象，也就是被ReactMethod注解标记的方法。
    mMethods.get(methodId).invoke(mJSInstance, token, parameters);
  }
}
```

JavaModuleWrapper对应C++层的NativeModule，该类针对Java BaseJavaModule进行了包装，是的C++层可以更加方便的通过JNI调用Java Module。




