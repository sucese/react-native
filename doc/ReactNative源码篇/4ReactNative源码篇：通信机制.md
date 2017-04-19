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
ReactInstanceManager：创建ReactContext、CatalystInstance等类，解析ReactPackage生成注册表，并且配合ReactRootView管理View的创建与生命周期等功能。
ReactContext：继承于ContextWrapper，是Rn应用的上下文，可以通过getContext()去获得。
ReactRootView：Rn应用的根视图。
ReactBridge：通信的核心类，通过JNI方式进行调用，C++层作为通信中间层。
NativeModuleRegistry：Java Module注册表。
JavascriptModuleRegistry：JS Module注册表。
CoreModulePackage：RN核心框架Package，包括Java接口与JS接口。
MainReactPackage：Rn封装的一些通用的Java组件与事件。
JSBundleLoader：用于加载JSBundle的类，根据不同的情况会创建不同的Loader。
JSBundle：JS代码包，存放JS核心逻辑。
```

在上一篇文章：[ReactNative源码篇：启动流程]()中，我们知道RN应用在启动的时候会创建JavaScriptModule注册表（JavaScriptModuleRegistry）与NativeModule注册表（NativeModuleRegistry），RN中Java层
与JS层的通信就是通过这两张表来完成的，我们来详细看一看。

## Java层调用JS层


在介绍Java层代码调用JS层代码之前，我们先来看一个Demo。

**举例**

1 首先我们定义一个接口继承于JavaScriptModule，该接口最终由JS来实现，Java来调用。




在上一篇文章：[ReactNative源码篇：启动流程]()中，我们在ReactInstanceManager.onAttachedToReactInstance()方法中调用APPRegistry.jS的runApplication()来
启动RN应用，这就是一个典型的Java层调用JS层的例子。

```
//启动流程入口：由Java层调用启动
catalystInstance.getJSModule(AppRegistry.class).runApplication(jsAppModuleName, appParams);
```

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

我们来分析上述代码的调用方式。

可以看出AppRegistry继承于JavaScriptModule，AppRegistry作为核心逻辑之一被添加到CoreModulesPackage中，我们知道在ReactInstanceManager.createReactContext()方法
中，CoreModulesPackage作为ReactPackage被添加进了JavaScriptModuleRegistry中，JavaScriptModuleRegistry被CatalystInstanceImpl来管理。

所以才有了Java层调用JS层代码的通用格式：

```
CatalystInstanceImpl.getJSModule(xxx.class).method(params, params, ...);
```

当然，如果使我们调用自己的JS Module，我们是用ReactContext.getJSModule()，因为ReactContext持有CatalystInstanceImpl的实例，CatalystInstanceImpl并不直接对外公开。


Java端要调用的JS端的类与方法，都需要注册到JS注册表中，然后进行调用，整个流程如下所示：


```
1 调用CatalystInstanceImpl.getJSmodule()->JavaScriptModuleRegistry.getJavaScriptModule()从注册表中获取对应的JSModule。
2 通过动态代理拿到方法的各种参数，包括moduleID、methodID与params。
3 将调用的方法与参数通过C层传递JS层，完成调用。
```


### JavaScriptModuleRegistry.getJavaScriptModule()

它的实现如下所示：

```java
public class JavaScriptModuleRegistry {

  public synchronized <T extends JavaScriptModule> T getJavaScriptModule(
    CatalystInstance instance,
    ExecutorToken executorToken,
    Class<T> moduleInterface) {
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
}
```

JavaScriptModuleRegistry.getJavaScriptModule()先去缓存中找JavaScriptModule，如果找到，直接返回。如果没有找到，用动态代理的方式重新创建JavaScriptModule。

我们再来看看JavaScriptModuleRegistry的内部类，它用来调用JavaScriptModule。

### JavaScriptModuleRegistry.JavaScriptModuleInvocationHandler.invoke()

```java
public class JavaScriptModuleRegistry {

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
      mCatalystInstance.callFunction(
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

JavaScriptModuleInvocationHandler.invoke()方法获取了moduleID，methodID，最终调用CatalystInstanceImpl.callFunction();

### CatalystInstanceImpl.callFunction();

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
CatalystInstanceImpl.jniCallJSCallback()将对应的moduledID, methodID和arguments通过JNI传递到JS端进行调用，JS层调用AppRegistry.runApplication()开始运行整个JS程序。

## JS调用Java

JS在调用Java并不是通过接口来进行的，而是对应的参数moduleID、methodID都push到一个messageQueue中，等待Java层的事件来驱动它，当Java层的事件传递过来以后，JS层把messageQUeue中的所有数据返回到Java层，再通过注册表JavaRegistry去
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





