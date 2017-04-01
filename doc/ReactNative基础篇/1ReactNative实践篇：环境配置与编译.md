#ReactNative实践：环境配置与编译

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

## 配置环境

Node, Watchman 

```
brew install node
brew install watchman
```

The React Native CLI

```
npm install -g react-native-cli
```

上次命令执行后，会输出：

/usr/local/Cellar/node/6.3.1/libexec/npm/bin/react-native -> /usr/local/Cellar/node/6.3.1/libexec/npm/lib/node_modules/react-native-cli/index.js
/usr/local/Cellar/node/6.3.1/libexec/npm/lib

这个时候需要把/usr/local/Cellar/node/6.3.1/libexec/npm/bin加到系统PATH中去。

Xcode 

## 创建项目

```
react-native init AwesomeProject
```

创建项目可能会非常的慢，这是因为在初始化的过程中，node-gyp需要进行编译，node-gyp 编译时候需要 NodeJs 源码来提供头文件，所以它会先尝试下载 NodeJs 源码，因为被墙的缘故
有时候下载 NodeJs 源码奇慢无比，那么自然要卡很久。所以解决方法就是，先把 NodeJs源码下载到本地，然后提取给 node-gyp。

执行脚本

```
bash node-gyp.sh
```

node-gyp.sh：

```
 # js 版本号
NODE_VERSION=`node -v | cut -d'v' -f 2`

echo ${NODE_VERSION}

# 下载源码包(使用镜像)
wget http://npm.taobao.org/mirrors/node/v$NODE_VERSION/node-v$NODE_VERSION.tar.gz

# 删除现有内容不完整的目录
rm -rf ~/.node-gyp
mkdir ~/.node-gyp

# 解压缩并重命名到正确格式
tar zxf node-v$NODE_VERSION.tar.gz -C ~/.node-gyp
mv ~/.node-gyp/node-v$NODE_VERSION ~/.node-gyp/$NODE_VERSION

# 创建一个标记文件
printf "9\n">~/.node-gyp/$NODE_VERSION/installVersion
执行该命令要首先安装了node，至于如何安装node，可自行搜索。

```

如果没有wget可以用homebrew去安装wget

```
brew install wget
```

另外，我们还要再做一个配置，npm官方的源不稳定，可以替换成国内淘宝的源

```
npm config set registry=http://registry.npm.taobao.org/
```

配置完成之后，再去初始化项目，大概2分钟创建项目完毕。

## 编译工程

编译ios

```
react-native run-ios
```

编译android

```
react-native run-android
```


运行命令后会开启一个React Packager的服务器

![](/art/run-android.png)

应用成功在设备上运行

<img src="/art/react_native_demo.png" width="300" height="500"/>

### 关于如何在真机上运行调试程序


前提条件：USB调试

你需要开启USB调试才能在你的设备上安装你的APP。首先，确定你已经打开设备的USB调试开关

确保你的设备已经成功连接。可以输入adb devices来查看:

```
$ adb devices
List of devices attached
emulator-5554 offline   # Google模拟器
14ed2fcc device         # 真实设备

```

在右边那列看到device说明你的设备已经被正确连接了。注意，你只应当连接仅仅一个设备。如果你连接了多个设备（包含模拟器在内），后
续的一些操作可能会失败。拔掉不需要的设备，或者关掉模拟器，确保adb devices的输出只有一个是连接状态。

现在你可以运行react-native run-android来在设备上安装并启动应用了。

>注意：在真机上运行时可能会遇到白屏的情况，请找到并开启悬浮窗权限。

从设备上访问开发服务器。在启用开发服务器的情况下，你可以快速的迭代修改应用，然后在设备上查看结果。按照下面描述的任意一种方法来使
你的运行在电脑上的开发服务器可以从设备上访问到。大部分现代的安卓设备已经没有了硬件"Menu"按键，这是我们用来调出开发者菜单的。在这
种情况下你可以通过摇晃设备来打开开发者菜单(重新加载、调试、etc)

Android 5.0及以上设备

```
adb reverse tcp:8081 tcp:8081
```

这个选项只能在5.0以上版本(API 21+)的安卓设备上使用。不需要更多配置，你就可以使用Reload JS和其它的开发选项了。

Android 5.0以下设备

通过Wi-Fi连接你的本地开发服务器

1. 首先确保你的电脑和手机设备在同一个Wi-Fi环境下。
2. 在设备上运行你的React Native应用。和打开其它App一样操作。
3. 你应该会看到一个“红屏”错误提示。这是正常的，下面的步骤会解决这个报错。
5. 摇晃设备，或者运行adb shell input keyevent 82，可以打开开发者菜单。4. 
6. 点击进入Dev Settings。
7. 点击Debug server host for device。
8. 输入你电脑的IP地址和端口号（譬如10.0.1.1:8081）。在Mac上，你可以在系统设置/网络里找查询你的IP地址。在Windows上，打开命令提示符并输入ipconfig来查
询你的IP地址。在Linux上你可以在终端中输入ifconfig来查询你的IP地址。
9. 回到开发者菜单然后选择Reload JS。
