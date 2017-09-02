# ReactNative源码篇：线程模型

**关于作者**

>郭孝星，非著名程序员，主要从事Android平台基础架构与中间件方面的工作，欢迎交流技术方面的问题，可以去我的[Github](https://github.com/guoxiaoxing)提交Issue或者发邮件至guoxiaoxingse@163.com与我联系。

文章目录：https://github.com/guoxiaoxing/react-native/blob/master/README.md

>本篇系列文章主要分析ReactNative源码，分析ReactNative的启动流程、渲染原理、通信机制与线程模型等方面内容。

- [1ReactNative源码篇：源码初识](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/1ReactNative源码篇：源码初识.md)
- [2ReactNative源码篇：代码调用](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：代码调用.md)
- [3ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/3ReactNative源码篇：启动流程.md)
- [4ReactNative源码篇：渲染原理](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/4ReactNative源码篇：渲染原理.md)
- [5ReactNative源码篇：线程模型](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/5ReactNative源码篇：线程模型.md)
- [6ReactNative源码篇：通信机制](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/6ReactNative源码篇：通信机制.md)
           							
RN应用中存在3个线程：

```
UI线程：即Android中的主线程，负责绘制UI以及监听用户操作。
Native线程：负责执行C++代码，该线程主要负责Java与C++的通信。
JS线程：负责解释执行JS。
```

在正式介绍RN线程模型之前，我们先来了解以下关于线程模型的核心概念。

MessageQueueThread

```
MessageQueueThread：对Thread进行封装，使其与Runnbale可以协同工作。
```

MessageQueueThreadImpl

```
MessageQueueThreadImpl：MessageQueueThread的实现类，3个线程的创建就是在这里完成的。
```


MessageQueueThreadSpec

```
MessageQueueThreadSpec：创建MessageQueueThread的说明书，描述将要创建的MessageQueueThread的相关细节。
```

ReactQueueConfiguration

```
ReactQueueConfiguration：接口，描述了RN应用中的3个线程，UI线程、Native线程与JS线程。
```

ReactQueueConfigurationSpec

```
ReactQueueConfigurationSpec：创建ReactQueueConfiguration的说明书，描述创建ReactQueueConfiguration的具体细节，
```

ReactQueueConfigurationImpl

```
ReactQueueConfigurationImpl：ReactQueueConfiguration的实现类。
```


## 线程的创建与传递流程流程

ReactInstanceManager在创建ReactContext的同时，创建了这3个线程，我们看下代码实现：

#### 1 ReactInstanceManager.createReactContext( JavaScriptExecutor jsExecutor, JSBundleLoader jsBundleLoader)

```java
public class ReactInstanceManager {

/**
   * @return instance of {@link ReactContext} configured a {@link CatalystInstance} set
   */
  private ReactApplicationContext createReactContext(
      JavaScriptExecutor jsExecutor,
      JSBundleLoader jsBundleLoader) {
 
 	...

    //查看外部是否设置NativeModuleCallExceptionHandler，它是在ReactInstanceManagerBuilder构建ReactInstanceManager是传递进来的
    //如果设置了则使用外部NativeModuleCallExceptionHandler，如果没有设置则使用DevSupportManager。
    NativeModuleCallExceptionHandler exceptionHandler = mNativeModuleCallExceptionHandler != null
        ? mNativeModuleCallExceptionHandler
        : mDevSupportManager;
    //jsExecutor、nativeModuleRegistry、nativeModuleRegistry等各种参数处理好之后，开始构建CatalystInstanceImpl实例。
    CatalystInstanceImpl.Builder catalystInstanceBuilder = new CatalystInstanceImpl.Builder()
        .setReactQueueConfigurationSpec(ReactQueueConfigurationSpec.createDefault())
        .setJSExecutor(jsExecutor)
        .setRegistry(nativeModuleRegistry)
        //生成JS Module注册表
        .setJSModuleRegistry(jsModulesBuilder.build())
        .setJSBundleLoader(jsBundleLoader)
        .setNativeModuleCallExceptionHandler(exceptionHandler);

    ...

    return reactContext;
  }
}
```

可以看到传入CatalystInstanceImpl的ReactQueueConfigurationSpec是由ReactQueueConfigurationSpec.createDefault()来创建的，我们来看一下它的实现。
创建流程。

#### 2 ReactQueueConfigurationSpec.createDefault()

```java
public class ReactQueueConfigurationSpec {

  public static ReactQueueConfigurationSpec createDefault() {
  	//MessageQueueThreadSpec并咩有做什么实际的创建工作，它相当于创建MessageQueue的说明书，告诉后续流程应该创建什么样的线程。
    MessageQueueThreadSpec spec = Build.VERSION.SDK_INT < 21 ?
        MessageQueueThreadSpec.newBackgroundThreadSpec("native_modules", LEGACY_STACK_SIZE_BYTES) :
        MessageQueueThreadSpec.newBackgroundThreadSpec("native_modules");
    return builder()
        .setJSQueueThreadSpec(MessageQueueThreadSpec.newBackgroundThreadSpec("js"))
        .setNativeModulesQueueThreadSpec(spec)
        .build();
  }
}
```
在该方法中，创建出的ReactQueueConfigurationSpec告诉后续流程需要创建Native线程与JS线程，我们进一步来看看ReactQueueConfigurationImpl.create()的实现。

#### 3 ReactQueueConfigurationImpl.create()

```java
public class CatalystInstanceImpl {

  //上面的createDefault()方法生成了默认的ReactQueueConfigurationSpec，告诉后续流程需要创建Native线程与JS线程，
  public static ReactQueueConfigurationImpl create(
      ReactQueueConfigurationSpec spec,
      QueueThreadExceptionHandler exceptionHandler) {

    Map<MessageQueueThreadSpec, MessageQueueThreadImpl> specsToThreads = MapBuilder.newHashMap();

    //创建关于UI线程的MessageQueueThreadSpec，并设置ExceptionHandler
    MessageQueueThreadSpec uiThreadSpec = MessageQueueThreadSpec.mainThreadSpec();
    //创建UI线程
    MessageQueueThreadImpl uiThread =
      MessageQueueThreadImpl.create( uiThreadSpec, exceptionHandler);
    specsToThreads.put(uiThreadSpec, uiThread);

    //给JS线程设置ExceptionHandler
    MessageQueueThreadImpl jsThread = specsToThreads.get(spec.getJSQueueThreadSpec());
    if (jsThread == null) {
      //创建JS线程
      jsThread = MessageQueueThreadImpl.create(spec.getJSQueueThreadSpec(), exceptionHandler);
    }

	//给Native线程设置ExceptionHandler
    MessageQueueThreadImpl nativeModulesThread =
        specsToThreads.get(spec.getNativeModulesQueueThreadSpec());
    if (nativeModulesThread == null) {
      //创建Native线程
      nativeModulesThread =
          MessageQueueThreadImpl.create(spec.getNativeModulesQueueThreadSpec(), exceptionHandler);
    }

    return new ReactQueueConfigurationImpl(uiThread, nativeModulesThread, jsThread);
  }
}
```

可以看出，该方法生成UI线程、Native线程与JS线程各自的MessageQueueThreadImpl，创建各自对应的线程，并设置相应的ExceptionHandler，我们来看一看线程是如何被创建的。

#### 4 MessageQueueThreadImpl.create(MessageQueueThreadSpec spec, QueueThreadExceptionHandler exceptionHandler)

```java
public class MessageQueueThreadImpl implements MessageQueueThread {

  public static MessageQueueThreadImpl create(
      MessageQueueThreadSpec spec,
      QueueThreadExceptionHandler exceptionHandler) {
    switch (spec.getThreadType()) {
      case MAIN_UI:
        return createForMainThread(spec.getName(), exceptionHandler);
      case NEW_BACKGROUND:
        return startNewBackgroundThread(spec.getName(), spec.getStackSize(), exceptionHandler);
      default:
        throw new RuntimeException("Unknown thread type: " + spec.getThreadType());
    }
  }
}
```
可以看出，MessageQueueThreadImpl将线程的创建分为两种情况：UI线程与Background线程，这也对应了MessageQueueThreadSpec里的枚举：

```
public class MessageQueueThreadSpec {
  protected static enum ThreadType {
    MAIN_UI,
    NEW_BACKGROUND,
  }
}
```

我们分别来看：

第一种情况：创建UI线程，准确来说是关联UI线程，因为UI线程是Android应用启动时，系统自己创建的。

```java
public class MessageQueueThreadImpl implements MessageQueueThread {
  /**
   * @return a MessageQueueThreadImpl corresponding to Android's main UI thread.
   */
  private static MessageQueueThreadImpl createForMainThread(
      String name,
      QueueThreadExceptionHandler exceptionHandler) {
  	//mainLooper是Android UI线程创建时自动创建，保存在Looper的静态变量mMainLooper中，通过
	//mainLooper可以向UI线程消息队列发送与界面操作相关的消息
    Looper mainLooper = Looper.getMainLooper();
    final MessageQueueThreadImpl mqt =
        new MessageQueueThreadImpl(name, mainLooper, exceptionHandler);

    if (UiThreadUtil.isOnUiThread()) {
      Process.setThreadPriority(Process.THREAD_PRIORITY_DISPLAY);
      MessageQueueThreadRegistry.register(mqt);
    } else {
      UiThreadUtil.runOnUiThread(
          new Runnable() {
            @Override
            public void run() {
              Process.setThreadPriority(Process.THREAD_PRIORITY_DISPLAY);
              MessageQueueThreadRegistry.register(mqt);
            }
          });
    }
    return mqt;
  }

  public static MessageQueueThreadImpl startNewBackgroundThread(
      final String name,
      QueueThreadExceptionHandler exceptionHandler) {
    return startNewBackgroundThread(
        name,
        MessageQueueThreadSpec.DEFAULT_STACK_SIZE_BYTES,
        exceptionHandler);
  }
}
```

第二种情况：创建Background线程

```java
public class MessageQueueThreadImpl implements MessageQueueThread {

  public static MessageQueueThreadImpl startNewBackgroundThread(
      final String name,
      QueueThreadExceptionHandler exceptionHandler) {
    return startNewBackgroundThread(
        name,
        MessageQueueThreadSpec.DEFAULT_STACK_SIZE_BYTES,
        exceptionHandler);
  }

  /**
   * Creates and starts a new MessageQueueThreadImpl encapsulating a new Thread with a new Looper
   * running on it. Give it a name for easier debugging and optionally a suggested stack size.
   * When this method exits, the new MessageQueueThreadImpl is ready to receive events.
   */
  public static MessageQueueThreadImpl startNewBackgroundThread(
      final String name,
      long stackSize,
      QueueThreadExceptionHandler exceptionHandler) {
    final SimpleSettableFuture<Looper> looperFuture = new SimpleSettableFuture<>();
    final SimpleSettableFuture<MessageQueueThread> mqtFuture = new SimpleSettableFuture<>();
    //构建新线程实例
    Thread bgThread = new Thread(null,
        new Runnable() {
          @Override
          public void run() {

          	//创建消息循环
            Looper.prepare();

            looperFuture.set(Looper.myLooper());
            MessageQueueThreadRegistry.register(mqtFuture.getOrThrow());
           	//使新创建的线程进入消息循环
            Looper.loop();
          }
        }, "mqt_" + name, stackSize);
    bgThread.start();

    //获取当前线程的Looper，该Looper会关联到一个Handler上，然后就可以通过该Handler发送消息到消息队列中了。
    Looper myLooper = looperFuture.getOrThrow();
    MessageQueueThreadImpl mqt = new MessageQueueThreadImpl(name, myLooper, exceptionHandler);
    mqtFuture.set(mqt);

    return mqt;
  }
}
```

这里牵扯到Android中的线程消息循环模型，我们简单回忆一下：

···
Android线程消息循环模型设计以下角色：

Thread：线程类。
MessageQueue：创建Looper时会同时创建一个消息队列MessageQueue，它作为一个消息存储单元，本身并不去处理消息。
Looper：Looper.prepare()为线程创建一个消息循环，Looper.loop()让该线程进入到消息循环中，Looper会不断的去MessageQueue查询是否有新消息到来。
Handler：与Looper相关联，处理Looper发送过来的消息，可以看到Handler的这种能力使得它可以做线程之间的切换。

每个Android应用在启动时都会创建一个UI线程，该线程会创建mainLooper，该Looper有且只会被创建一次。每个新创建的子线程，也可以加上Looper使得它具有消息
循环的能力。
···

#### 5 CatalystInstanceImpl::initializeBridge()

在[3ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/awesome-react-native/blob/master/doc/ReactNative源码篇/3ReactNative源码篇：启动流程.md)文章中
我们知道，在CatalystInstanceImpl.java里会调用initializeBridge()将新创建的JS线程与Native线程传入到C++层。

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
      mJavaRegistry.getJavaModules(this),
      mJavaRegistry.getCxxModules());
    FLog.w(ReactConstants.TAG, "Initializing React Xplat Bridge after initializeBridge");
    mMainExecutorToken = getMainExecutorToken();
  }
)
```
CatalystInstanceImpl.initializeBridge()传递JS线程与Native线程的调用链为：CatalystInstanceImpl.java的initializeBridge()方法 -> CatalystInstanceImpl.cpp的
initializeBridge()方法 -> Instance.cpp的initializeBridge()方法，该方法的实现如下所示：

#### 6 Instance::initializeBridge(std::unique_ptr<InstanceCallback> callback, std::shared_ptr<JSExecutorFactory> jsef, std::shared_ptr<MessageQueueThread> jsQueue, std::unique_ptr<MessageQueueThread> nativeQueue, std::shared_ptr<ModuleRegistry> moduleRegistry)

```c++
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

  //对应着Java层的MessageQueueThreadImpl jsQueueThread
  jsQueue->runOnQueueSync(
    [this, &jsef, moduleRegistry, jsQueue,
     nativeQueue=folly::makeMoveWrapper(std::move(nativeQueue))] () mutable {
      nativeToJsBridge_ = folly::make_unique<NativeToJsBridge>(
          jsef.get(), moduleRegistry, jsQueue, nativeQueue.move(), callback_);

      std::lock_guard<std::mutex> lock(m_syncMutex);
      m_syncReady = true;
      m_syncCV.notify_all();
    });

  CHECK(nativeToJsBridge_);
}
···

JS线程jsQueue传递给JSCExecutor.cpp用来执行JS文件，Native线程传递给NativeToJsBridge.cpp，用来创建通信桥，负责Java与JS的通信。