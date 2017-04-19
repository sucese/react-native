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

>通信，指的是RN中Java与JS的通信，即JS中的JSX代码如何转化成Java层真实的View与事件的，以及JavaFile层又是如何调用JS来找出它需要的View与
事件的。

在正式介绍通信流程之前，我们先来看看整个流程中牵扯到的各个类的作用。

```
ReactInstanceManager：创建ReactContext、CatalystInstance等类，解析ReactPackage生成映射表，并且配合ReactRootView管理View的创建与生命周期等功能。
ReactContext：继承于ContextWrapper，是Rn应用的上下文，可以通过getContext()去获得。
ReactRootView：Rn应用的根视图。
ReactBridge：通信的核心类，通过JNI方式进行调用，C++层作为通信中间层。
NativeModuleRegistry：Java Module映射表。
JavascriptModuleRegistry：JS Module映射表。
CoreModulePackage：RN核心框架Package，包括Java接口与JS接口。
MainReactPackage：Rn封装的一些通用的Java组件与事件。
JSBundleLoader：用于加载JSBundle的类，根据不同的情况会创建不同的Loader。
JSBundle：JS代码包，存放JS核心逻辑。
```

在上一篇文章：[ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：启动流程.md)中，我们知道RN应用在启动的时候会创建JavaScriptModule映射表（JavaScriptModuleRegistry）与NativeModule映射表（NativeModuleRegistry），RN中Java层
与JS层的通信就是通过这两张表来完成的，我们来详细看一看。

## Java层调用JS层

**举例**

在上一篇文章：[ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：启动流程.md)中，我们在ReactInstanceManager.onAttachedToReactInstance()方法中调用APPRegistry.jS的runApplication()来
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
1 把要实现的功能编写成接口并继承JavaScriptModule，并交由ReactPackage管理，最终会在RN初始化的时候添加到JavaScriptModuleRegistry映射表中。

```

C++层

```
```

JavaScript层

```
```


我们来分析上述代码的调用方式。

可以看出AppRegistry继承于JavaScriptModule，AppRegistry作为核心逻辑之一被添加到CoreModulesPackage中，我们知道在ReactInstanceManager.createReactContext()方法
中，CoreModulesPackage作为ReactPackage被添加进了JavaScriptModuleRegistry中，JavaScriptModuleRegistry被CatalystInstanceImpl来管理。

所以才有了Java层调用JS层代码的通用格式：

```
CatalystInstanceImpl.getJSModule(xxx.class).method(params, params, ...);
```

当然，如果使我们调用自己的JS Module，我们是用ReactContext.getJSModule()，因为ReactContext持有CatalystInstanceImpl的实例，CatalystInstanceImpl并不直接对外公开。

### 实现细节-Java层

Java层代码调用JS层代码，需要将JavaScriptModule注册到JavaScriptModuleRegistry中，然后通过动态代理获取方法的各种参数，再将参数通过参数通过C++层传递到JS层从而完成调用，我们
先来看看CatalystInstanceImpl是如何拿到JavaScriptModule的。

CatalystInstanceImpl.getJSModule()调用JavaScriptModuleRegistry.getJavaScriptModule()去查询JavaScriptModule。

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

### 实现细节-C++层

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

  callNativeModules(std::move(result));
}
```

我们先来解释下m_callFunctionReturnFlushedQueueJS这个变量的由来，它在JSCExecutor::bindBridge()里初始化，本质上就是通过Webkit JSC拿到JS层代码相关对象
和方法引用，m_callFunctionReturnFlushedQueueJS就是MessageQueue.js里的callFunctionReturnFlushedQueue()方法的引用。

```c++
void JSCExecutor::bindBridge() throw(JSException) {

  ...

 m_callFunctionReturnFlushedQueueJS = batchedBridge.getProperty("callFunctionReturnFlushedQueue").asObject();

  ...
}
```

### 实现细节-JavaScript层

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

    //从JS层的JavaScriptModule映射表中查找到AppRegistry.js
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

## JS调用Java

JS在调用Java并不是通过接口来进行的，而是对应的参数moduleID、methodID都push到一个messageQueue中，等待Java层的事件来驱动它，当Java层的事件传递过来以后，JS层把messageQUeue中的所有数据返回到Java层，再通过映射表JavaRegistry去
调用方法。

我们先来看一下大致的流程：

```
1 JS将方法的对应参数push到MessageQueue中， 等待Java端的事件传递。
2 Java端事件触发之后，JS层将MessageQueue中的数据通过C层传递到Java层。
3 C层调用一开始注册在其中的NativeModulesReactCallback。
4 然后通过JavaRegistry拿到对应的module与method。
5 通过反射执行方法。
```


### 

Libraries/BatcherBridge/MessageQueue.js

```javascript

class MessageQueue {

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

}
```
###

Java层的事件驱动也可以额看成Java层与JS层的通信，最终会调用MessageQueue.callFunctionReturnFlushedQueue()方法。

Libraries/BatcherBridge/MessageQueue.js

```javascript

class MessageQueue {

  callFunctionReturnFlushedQueue(module: string, method: string, args: Array<any>) {
    guard(() => {
      this.__callFunction(module, method, args);
      this.__callImmediates();
    });

    return this.flushedQueue();
  }

}
```

然后调用MessageQueue.flushedQueue()将MessageQueue中的所有数据通过C层发往JS层。

```javascript

class MessageQueue {

  flushedQueue() {
    this.__callImmediates();

    const queue = this._queue;
    this._queue = [[], [], [], this._callID];
    return queue[0].length ? queue : null;
  }


}
```
事件到达Java层后调用NativeModulesReactCallback.call()方法。

``





