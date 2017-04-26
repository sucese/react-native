# ReactNative源码篇：代码调用

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
						
## Java与C++的交互

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

## JavaScript与C++的交互

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

### C++调用JavaScript

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
### JavaScript调用C++

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