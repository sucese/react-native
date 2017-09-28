# ReactNative源码篇：代码调用

**关于作者**

>郭孝星，程序员，吉他手，主要从事Android平台基础架构方面的工作，欢迎交流技术方面的问题，可以去我的[Github](https://github.com/guoxiaoxing)提issue或者发邮件至guoxiaoxingse@163.com与我交流。

更多文章：https://github.com/guoxiaoxing/react-native/blob/master/README.md

**文章目录**

- 一 执行器的实现
    - 1.1 Native代码执行器
    - 1.2 JS代码执行器
- 二 Java与C++的交互
- 三 JavaScript与C++的交互

更多文章：https://github.com/guoxiaoxing/react-native/blob/master/README.md

>本篇系列文章主要分析ReactNative源码，分析ReactNative的启动流程、渲染原理、通信机制与线程模型等方面内容。

- [1ReactNative源码篇：源码初识](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/1ReactNative源码篇：源码初识.md)
- [2ReactNative源码篇：代码调用](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/2ReactNative源码篇：代码调用.md)
- [3ReactNative源码篇：启动流程](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/3ReactNative源码篇：启动流程.md)
- [4ReactNative源码篇：渲染原理](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/4ReactNative源码篇：渲染原理.md)
- [5ReactNative源码篇：线程模型](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/5ReactNative源码篇：线程模型.md)
- [6ReactNative源码篇：通信机制](https://github.com/guoxiaoxing/react-native/blob/master/doc/ReactNative源码篇/6ReactNative源码篇：通信机制.md)
		
## 一 执行器的实现

在C++层的Executor.h文件中同一定义了执行Native代码的抽象类ExecutorDelegate，以及执行JS代码的抽象类JSExecutor。

### 1.1 Native代码执行器

ExecutorDelegate：在Executor.h中定义，由JsToNativeBridge实现，该抽象类用于JS代码调用Native代码，该类的类图如下所示：

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/6/UMLClassDiagram-ExecutorDelegate.png"/>

```c++

// This interface describes the delegate interface required by
// Executor implementations to call from JS into native code.
class ExecutorDelegate {
 public:
  virtual ~ExecutorDelegate() {}

  //注册JS执行器
  virtual void registerExecutor(std::unique_ptr<JSExecutor> executor,
                                std::shared_ptr<MessageQueueThread> queue) = 0;
  //注销JS执行器
  virtual std::unique_ptr<JSExecutor> unregisterExecutor(JSExecutor& executor) = 0;

  //获取模块注册表
  virtual std::shared_ptr<ModuleRegistry> getModuleRegistry() = 0;

  //调用Native Module，在它实现中，它会进一步调用ModuleRegistry::callNativeMethod() -> NativeModule::invoke()，进而
  //完成对Native Module的调用。
  virtual void callNativeModules(
    JSExecutor& executor, folly::dynamic&& calls, bool isEndOfBatch) = 0;
  virtual MethodCallResult callSerializableNativeHook(
    JSExecutor& executor, unsigned int moduleId, unsigned int methodId, folly::dynamic&& args) = 0;
};
```

### 1.2 JS代码执行器

JS的解析是在Webkit-JavaScriptCore中完成的，JSCExexutor.cpp对JavaScriptCore的功能做了进一步的封装，我们来看一下它的实现。

JSExecutor：在Executor.h中定义，正如它的名字那样，它是用来执行JS代码的。执行代码的命令是通过JS层的BatchedBridge传递过来的。


我们先来看一下JSExecutor的类图，可以看到

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/3/UMLClassDiagram-JSExecutor.png"/>

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

可以看到除了JSExecutor.cpp实现了抽象类JSExecutor里的方法，ProxyExecutor.cpp也实现了它里面的方法，这是RN给了我们自定义JS解析器的能力，可以在CatalystInstance.Builder里
setJSExecutor()，具体可以参见JavaJSExecutor与ProxyJavaScriptExecutor，它们的类图如下所示：

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/3/UMLClassDiagram-cxxbridge-ProxyJavaScriptExecutor.png"/>

## 二 Java与C++的交互

我们都知道如果需要用Java调用C/C++，需要用到Java中的JNI，但是用过JNI的同学都知道这是个繁琐且低效的调用方式，在大型工程体现的更加明显，因为我们需要将Java与C/C++的
相互访问与通信框架化，形成更高层次的封装，避免直接使用原始的JNI反射API去做调用。

RN框架便有着优秀的Java与Native访问框架，这套框架的核心在于JNI智能指针，我们来详细的看一看它的实现原理。

Java对象（jobject）在Native层有3种引用类型：

全局引用

```
全局引用：使用NewGlobalRef创建，使用DeleteGlobalRef销毁。支持跨线程访问，在调用DeleteGlobalRef销毁前，GC无法回收该引用对应的Java Object。
```

局部引用

```
局部引用：使用NewLocalRef创建，使用DeleteLocalRef销毁。只能在本线程内安全访问，当创建该引用的Native调用链返回至JVM时，未被销毁的局部引用可以被GC回收，但是局部引用表容量有限，应该
在返回JVM前，调用DeleteLocalRef先行销毁，避免局部引用表超限引用崩溃。
```

弱全局引用

```
局部引用：使用NewWeekGlobalRef创建，使用DeleteWeekGlobalRef销毁。与全局引用一样具有全局作用域，但是不会影响GC回收，GC可以随时回收该引用。
```

JNI动态注册

JNI在注册Native函数时，可以利用javah命令生成函数签名，而静态注册就是利用这些函数名在JNI层中寻找着写函数，如果没有找到就会报错，如果找到了就会建立一个关联关系，以后
在调用时就会直接调用这个函数，该操作有虚拟机来完成。但是每次调用都要进行查找的做法效率比较低，因而便衍生了动态注册的方法。

动态注册

>动态注册允许你提供一个函数映射表，提供给虚拟机，这样虚拟机就可以根据函数映射表来调用相应的函数。

函数映射表中函数的结构如下所示：

```c
typedef struct { 
const char* name; //Java中Native方法的名字
const char* signature; //Java中Native方法的参数和返回值。
void* fnPtr; //函数指针，指向C函数
} JNINativeMethod; 
```

JNI_OnLoad()函数在System.loadLibrary加载完JNI动态库后会自动调用，我们在这里完成动态注册工作，该函数有2个作用：

```
1 指定JNI版本，告诉虚拟机应该使用哪一个JNI版本。
2 注册Native函数，调用方法jint RegisterNatives(jclass clazz, const JNINativeMethod* methods,jint nMethods)来实现。
```

我们来看一个简单的例子。

1 在Java层编写本地方法

```java
public class HelloJni { 

	static {
        System.loadLibrary("hello-jni");
    }

    public static final main(String[] args){
    	System.out.println(stringFromJNI());
    }

    public native String stringFromJNI();
}
```

2 在JNI中进行动态注册

```c
#include <stdlib.h>  
#include <string.h>  
#include <stdio.h>  
#include <jni.h>  
#include <assert.h>  
  
/* This is a trivial JNI example where we use a native method 
 * to return a new VM String. See the corresponding Java source 
 * file located at: 
 * 
 *   apps/samples/hello-jni/project/src/com/example/HelloJni/HelloJni.java 
 */  
jstring native_hello(JNIEnv* env, jobject thiz)  
{  
    return (*env)->NewStringUTF(env, "动态注册JNI");  
}  
  
/** 
* 方法对应表 
*/  
static JNINativeMethod gMethods[] = {  
    {"stringFromJNI", "()Ljava/lang/String;", (void*)native_hello},
};  
  
/* 
* 为某一个类注册本地方法 
*/  
static int registerNativeMethods(JNIEnv* env  
        , const char* className  
        , JNINativeMethod* gMethods, int numMethods) {  
    jclass clazz;  
    clazz = (*env)->FindClass(env, className);  
    if (clazz == NULL) {  
        return JNI_FALSE;  
    }  
    if ((*env)->RegisterNatives(env, clazz, gMethods, numMethods) < 0) {  
        return JNI_FALSE;  
    }  
  
    return JNI_TRUE;  
}  
  
  
/* 
* 为所有类注册本地方法 
*/  
static int registerNatives(JNIEnv* env) {
	//指定要注册的类
    const char* kClassName = "com/example/hellojni/HelloJni";
    return registerNativeMethods(env, kClassName, gMethods,  
            sizeof(gMethods) / sizeof(gMethods[0]));  
}  
  
/* 
* System.loadLibrary("lib")时调用自动调用JNI_OnLoad
* 如果成功返回JNI版本, 失败返回-1 
*/  
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {  
    JNIEnv* env = NULL;  
    jint result = -1;  
  
    if ((*vm)->GetEnv(vm, (void**) &env, JNI_VERSION_1_4) != JNI_OK) {  
        return -1;  
    }  
    assert(env != NULL);  
  
    if (!registerNatives(env)) {//注册  
        return -1;  
    }  
    //成功  
    result = JNI_VERSION_1_4;  
  
    return result;  
} 
```

## 三 JavaScript与C++的交互

RN解析JS用的是Webkit的脚本引擎JavaScriptCore，JavaScriptCore负责JS的解释与执行。

> Webkit是一个开源的浏览器引擎，Safari、Chrome等浏览器都使用了该引擎，它包括一个网页排版渲染引擎WebCore与一个脚本引擎JavaScriptCore。

JavaScriptCore API数据结构：

```
JSGlobalContextRef：JavaScript全局上下文。也就是JavaScript的执行环境。
JSValueRef：JavaScript的一个值，可以是变量、object、函数。
JSObjectRef：JavaScript的一个object或函数。
SStringRef：JavaScript的一个字符串。
JSClassRef：JavaScript的类。
JSClassDefinition：JavaScript的类定义，使用这个结构，C、C++可以定义和注入JavaScript的类。
```

JavaScriptCore API主要函数：

```
JSGlobalContextCreateJSGlobalContextRelease：创建和销毁JavaScript全局上下文。
JSContextGetGlobalObject：获取JavaScript的Global对象。
JSObjectSetPropertyJSObjectGetProperty：JavaScript对象的属性操作。
JSEvaluateScript：执行一段JS脚本。
JSClassCreate：创建一个JavaScript类。
JSObjectMake：创建一个JavaScript对象。
JSObjectCallAsFunction：调用一个JavaScript函数。
JSStringCreateWithUTF8CstringJSStringRelease：创建、销毁一个JavaScript字符串
JSValueToBooleanJSValueToNumber JSValueToStringCopy：JSValueRef转为C++类型
JSValueMakeBooleanJSValueMakeNumber JSValueMakeString：C++类型转为JSValueRef
```

### 3.1 C++调用JavaScript

1 获取Global全局对象

```c++
JSGlobalContextRef context = JSGlobalContextCreate(NULL);
JSObjectRef global = JSContextGetGlobalObject(ctx); 
```
2 获取JavaScript的全局变量、全局函数或者全局复杂对象，并完成调用。

```c++
//获取全局变量
JSStringRef varName = JSStringCreateWithUTF8CString("JavaScript变量名");
JSValueRef var = JSObjectGetProperty(ctx, globalObj, varName,NULL); JSStringRelease(varName);
//转化为C++类型
int n = JSValueToNumber(ctx, var, NULL);

//获取全局函数
JSStringRef funcName = JSStringCreateWithUTF8CString("JavaScript函数名");
JSValueRef func = JSObjectGetProperty(ctx, globalObj, funcName,NULL); JSStringRelease(funcName);
//装换为函数对象
JSObjectRef funcObject = JSValueToObject(ctx,func, NULL);
//组织参数,将两个数值1和2作为两个参数
JSValueRef args[2];
args[0] = JSValueMakeNumber(ctx, 1);
args[1] = JSValueMakeNumber(ctx, 2);
//调用函数
JSValueRef returnValue = JSObjectCallAsFunction(ctx, funcObject,NULL, 2, args, NULL);
//处理返回值
int ret = JSValueToNumber(ctx, returnValue, NULL);

//获取复杂的对象
JSStringRef objName=JSStringCreateWithUTF8CString("JavaScript复杂对象名");
JSValueRef obj = JSObjectGetProperty(ctx, globalObj, objName,NULL); JSStringRelease(objName);
//装换为对象
JSObjectRef object = JSValueToObject(ctx,obj, NULL);
//获取对象的方法
JSStringRef funcObjName =JSStringCreateWithUTF8CString("JavaScript复杂对象的方法");
JSValueRef objFunc = JSObjectGetProperty(ctx, object, funcObjName,NULL); JSStringRelease(funcObjName);
//调用复杂对象的方法,这里省略了参数和返回值
JSObjectCallAsFunction(ctx, objFunc, NULL, 0, 0, NULL);

```
### 3.2 JavaScript调用C++

JavaScript想要调用C++，就必须先要将C++里的变量、函数与类注入到JavaScript中。

1 定义一个C++类，在类中定义一组全局函数，并封装JavaScriptCore对C++类的调用，提供给JavaScriptCore进行CallBack回调。

```c++
class test{         

public:
    test(){
        number=0;
    };

    void func(){
        number++;
    }
    int number;
};

test g_test;//变量定义

//全局函数，封装test类的func方法调用
JSValueRef testFunc(JSContextRef ctx, JSObjectRef ,JSObjectRef thisObject, size_t argumentCount, const JSValueRef arguments[],JSValueRef*){

    test* t =static_cast<test*>(JSObjectGetPrivate(thisObject));
    t->func();
    returnJSValueMakeUndefined(ctx);
}

//全局函数，封装test类的成员变量number的get操作

JSValueRef getTestNumber(JSContextRef ctx, JSObjectRefthisObject, JSStringRef, JSValueRef*){

    test* t =static_cast<test*>(JSObjectGetPrivate(thisObject));
    returnJSValueMakeNumber(ctx, t->number);
}

//使用一个函数, 创建JavaScript类
JSClassRef createTestClass(){

    //类成员变量定义，可以有多个，最后一个必须是{ 0, 0, 0 }，也可以指定set操作
    static JSStaticValuetestValues[] = {
        {"number", getTestNumber, 0, kJSPropertyAttributeNone },
        { 0, 0, 0, 0}
    };

    //类的方法定义，可以有多个，最后一个必须是{ 0, 0, 0 }
    staticJSStaticFunction testFunctions[] = {
        {"func", testFunc, kJSPropertyAttributeNone },
        { 0, 0, 0 }
    };

    //定义一个类
    staticJSClassDefinition classDefinition = {

        0,kJSClassAttributeNone, "test", 0, testValues, testFunctions,
        0, 0, 0, 0,0, 0, 0, 0, 0, 0, 0

    };

    //JSClassCreate执行后，就创建一个了JavaScript test类
    staticJSClassRef t = JSClassCreate(&classDefinition);
    return t;
}
```

2 创建JavaScript类

```
createTestClass ();
JSGlobalContextRef ctx = JSGlobalContextCreate(NULL);
JSObjectRef globalObj = JSContextGetGlobalObject(ctx); 
```
   

3 新建一个JavaScript类对象，并使之绑定g_test变量

```
JSObjectRef classObj= JSObjectMake(ctx,testClass(), &g_test);
```

4 将新建的对象注入JavaScript中

```
JSStringRef objName= JSStringCreateWithUTF8CString("g_test");
JSObjectSetProperty(ctx,globalObj,objName,classObj,kJSPropertyAttributeNone,NULL);
```
 
将C++类和类指针注入到JavaScript后，在JavaScript中就可以这样使用了：

```
g_test.func();
var n = g_test.number;
var t = new test;
````