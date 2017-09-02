# ReactNative源码篇：渲染原理

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

在讲解渲染原理之前，我们先来看一个简单的例子。

```javascript
import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View
} from 'react-native';

export default class android_container extends Component {
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>
          Welcome to React Native!
        </Text>
        <Text style={styles.instructions}>
          To get started, edit index.ios.js
        </Text>
        <Text style={styles.instructions}>
          Press Cmd+R to reload,{'\n'}
          Cmd+D or shake for dev menu
        </Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

AppRegistry.registerComponent('android_container', () => android_container);
```

我们接触到的React Native代码通常都是JSX代码，JSX其实是一种语法糖，实际运行的时候，它还是会转换为真正的js代码，为了方便我们理解原理，我们先把上述
代码转换为js代码。

注：转换可以通过[babel](https://babeljs.io/repl/).

```javascript
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactNative = require('react-native');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            *
var android_container = function (_Component) {
  _inherits(android_container, _Component);

  function android_container() {
    _classCallCheck(this, android_container);

    return _possibleConstructorReturn(this, (android_container.__proto__ || Object.getPrototypeOf(android_container)).apply(this, arguments));
  }

  _createClass(android_container, [{
    key: 'render',
    value: function render() {
      return _react2.default.createElement(
        _reactNative.View,
        { style: styles.container },
        _react2.default.createElement(
          _reactNative.Text,
          { style: styles.welcome },
          'Welcome to React Native!'
        ),
        _react2.default.createElement(
          _reactNative.Text,
          { style: styles.instructions },
          'To get started, edit index.ios.js'
        ),
        _react2.default.createElement(
          _reactNative.Text,
          { style: styles.instructions },
          'Press Cmd+R to reload,',
          '\n',
          'Cmd+D or shake for dev menu'
        )
      );
    }
  }]);

  return android_container;
}(_react.Component);

exports.default = android_container;


var styles = _reactNative.StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF'
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5
  }
});

_reactNative.AppRegistry.registerComponent('android_container', function () {
  return android_container;
});
```

我们可以看到原来的JSX组件都会被转换为ReactElement组件，该组件定义在ReactElement.js文件中，用来描述js上的ui组件，它里面存放了props等信息。

React Native渲染序列图如下所示：

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/render_sequence.png"/>

我们先来简单概括一下整个渲染流程：

1. React Native将代码由JSX转化为JS组件，启动过程中利用instantiateReactComponent将ReactElement转化为复合组件ReactCompositeComponent与元组件ReactNativeBaseComponent，利用
ReactReconciler对他们进行渲染。
2. UIManager.js利用C++层的Instance.cpp将UI信息传递给UIManagerModule.java，并利用UIManagerModule.java构建UI。
3. UIManagerModule.java接收到UI信息后，将UI的操作封装成对应的Action，放在队列中等待执行。各种UI的操作，例如创建、销毁、更新等便在队列里完成，UI最终
得以渲染在屏幕上。

如上图所示AppRegistry.registerComponent用来注册组件，在该方法内它会调用AppRegistry.runApplication()来启动js的渲染流程。AppRegistry.runApplication()
会将传入的Component转换成ReactElement，并在外面包裹一层AppContaniner，AppContaniner主要用来提供一些debug工具（例如：红盒）。

如下所示：

```javascript
function renderApplication<Props: Object>(
  RootComponent: ReactClass<Props>,
  initialProps: Props,
  rootTag: any
) {
  invariant(
    rootTag,
    'Expect to have a valid rootTag, instead got ', rootTag
  );
  ReactNative.render(
    <AppContainer rootTag={rootTag}>
      <RootComponent
        {...initialProps}
        rootTag={rootTag}
      />
    </AppContainer>,
    rootTag
  );
}
```

我们抛开函数调用链，分析其中关键的部分，其他部分都是简单的函数调用。

## 关键点1：ReactNativeMount.renderComponent()

```javascript
  /**
   * @param {ReactComponent} instance Instance to render.
   * @param {containerTag} containerView Handle to native view tag
   */
  renderComponent: function(
    nextElement: ReactElement<*>,
    containerTag: number,
    callback?: ?(() => void)
  ): ?ReactComponent<any, any, any> {
  
    //将RectElement使用相同的TopLevelWrapper进行包裹
    var nextWrappedElement = React.createElement(
      TopLevelWrapper,
      { child: nextElement }
    );

    var topRootNodeID = containerTag;
    var prevComponent = ReactNativeMount._instancesByContainerID[topRootNodeID];
    if (prevComponent) {
      var prevWrappedElement = prevComponent._currentElement;
      var prevElement = prevWrappedElement.props.child;
      if (shouldUpdateReactComponent(prevElement, nextElement)) {
        ReactUpdateQueue.enqueueElementInternal(prevComponent, nextWrappedElement, emptyObject);
        if (callback) {
          ReactUpdateQueue.enqueueCallbackInternal(prevComponent, callback);
        }
        return prevComponent;
      } else {
        ReactNativeMount.unmountComponentAtNode(containerTag);
      }
    }

    if (!ReactNativeTagHandles.reactTagIsNativeTopRootID(containerTag)) {
      console.error('You cannot render into anything but a top root');
      return null;
    }

    ReactNativeTagHandles.assertRootTag(containerTag);

    //检查之前的节点是否已经mount到目标节点上，如果有则进行比较处理
    var instance = instantiateReactComponent(nextWrappedElement, false);
    ReactNativeMount._instancesByContainerID[containerTag] = instance;

    // The initial render is synchronous but any updates that happen during
    // rendering, in componentWillMount or componentDidMount, will be batched
    // according to the current batching strategy.

    //将mount任务提交给回调Queue，最终会调用ReactReconciler.mountComponent()
    ReactUpdates.batchedUpdates(
      batchedMountComponentIntoNode,
      instance,
      containerTag
    );
    var component = instance.getPublicInstance();
    if (callback) {
      callback.call(component);
    }
    return component;
  },
```
该方法主要做了以下事情：

1. 将传入的RectElement使用相同的TopLevelWrapper进行包裹，生成nextWrappedElement。
2. 检查之前的节点是否已经mount到目标节点上，如果有则进行比较处理，将上一步生成的nextWrappedElement传入instantiateReactComponent(nextWrappedElement, false)方法。
3. 将mount任务提交给回调Queue，最终会调用ReactReconciler.mountComponent()，ReactReconciler.mountComponent()又会去调用C++层Instance::mountComponent()
方法。

## 关键点2：instantiateReactComponent.instantiateReactComponent(node, shouldHaveDebugID)

在分析这个函数之前，我们先来补充一下React组件相关知识。React组件可以分为两种：

- 元组件：框架内置的，可以直接使用的组件。例如：View、Image等。它在React Native中用ReactNativeBaseComponent来描述。
- 复合组件：用户封装的组件，一般可以通过React.createClass()来构建，提供render()方法来返回渲染目标。它在React Native中用ReactCompositeComponent来描述。

instantiateReactComponent(node, shouldHaveDebugID)方法根据对象的type生成元组件或者复合组件。

```javascript
/**
 * Given a ReactNode, create an instance that will actually be mounted.
 *
 * @param {ReactNode} node
 * @param {boolean} shouldHaveDebugID
 * @return {object} A new instance of the element's constructor.
 * @protected
 */
function instantiateReactComponent(node, shouldHaveDebugID) {
  var instance;

  if (node === null || node === false) {
    instance = ReactEmptyComponent.create(instantiateReactComponent);
  } else if (typeof node === 'object') {
    var element = node;
    var type = element.type;

    if (typeof type !== 'function' && typeof type !== 'string') {
      var info = '';
      if (process.env.NODE_ENV !== 'production') {
        if (type === undefined || typeof type === 'object' && type !== null && Object.keys(type).length === 0) {
          info += ' You likely forgot to export your component from the file ' + 'it\'s defined in.';
        }
      }
      info += getDeclarationErrorAddendum(element._owner);
      !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s', type == null ? type : typeof type, info) : _prodInvariant('130', type == null ? type : typeof type, info) : void 0;
    }

    //如果对象的type为string，则调用ReactHostComponent.createInternalComponent(element)来注入生成组件的逻辑
    if (typeof element.type === 'string') {
      instance = ReactHostComponent.createInternalComponent(element);
    }
    //如果是内部元组件，则创建一个type实例
    else if (isInternalComponentType(element.type)) {
      // This is temporarily available for custom components that are not string
      // representations. I.e. ART. Once those are updated to use the string
      // representation, we can drop this code path.
      instance = new element.type(element);

      // We renamed this. Allow the old name for compat. :(
      if (!instance.getHostNode) {
        instance.getHostNode = instance.getNativeNode;
      }
    } 
    //否则，则是用户创建的复合组件，这个时候创建一个ReactCompositeComponentWrapper实例，该实例用来描述复合组件
    else {
      instance = new ReactCompositeComponentWrapper(element);
    }
    //当对象为string或者number时，调用ReactHostComponent.createInstanceForText(node)来注入组件生成逻辑。
  } else if (typeof node === 'string' || typeof node === 'number') {
    instance = ReactHostComponent.createInstanceForText(node);
  } else {
    !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Encountered invalid React node of type %s', typeof node) : _prodInvariant('131', typeof node) : void 0;
  }

  if (process.env.NODE_ENV !== 'production') {
    process.env.NODE_ENV !== 'production' ? warning(typeof instance.mountComponent === 'function' && typeof instance.receiveComponent === 'function' && typeof instance.getHostNode === 'function' && typeof instance.unmountComponent === 'function', 'Only React Components can be mounted.') : void 0;
  }

  // These two fields are used by the DOM and ART diffing algorithms
  // respectively. Instead of using expandos on components, we should be
  // storing the state needed by the diffing algorithms elsewhere.
  instance._mountIndex = 0;
  instance._mountImage = null;

  if (process.env.NODE_ENV !== 'production') {
    instance._debugID = shouldHaveDebugID ? getNextDebugID() : 0;
  }

  // Internal instances should fully constructed at this point, so they should
  // not get any new fields added to them at this point.
  if (process.env.NODE_ENV !== 'production') {
    if (Object.preventExtensions) {
      Object.preventExtensions(instance);
    }
  }

  return instance;
}
```

该方法根据对象的type生成元组件或者复合组件，具体流程如下：

1. 如果对象的type为string，则调用ReactHostComponent.createInternalComponent(element)来注入生成组件的逻辑，如果是内部元组件，则创建一个type实例，
否则，则是用户创建的复合组件，这个时候创建一个ReactCompositeComponentWrapper实例，该实例用来描述复合组件。
2. 当对象为string或者number时，调用ReactHostComponent.createInstanceForText(node)来注入组件生成逻辑。
3. 以上都不是，则报错。

我们通过前面的分析，了解了整个UI开始渲染的时机，以及js层的整个渲染流程，接下来，我们开始分析每个js的组件时怎么转换成Android的组件，最终显示在屏幕上的。

上面我们提到元组件与复合组件，事实上复合组件也是递归遍历其中的元组件，然后进行渲染。所以我们重点关注元组件的生成逻辑。

元组件的渲染流程图如下所示：

<img src="https://github.com/guoxiaoxing/react-native/raw/master/art/source/4/react_native_render_principle_flow.png"/>

我们可以看到，UI渲染主要通过UIManager来完成，UIManager是一个ReactModule，UIManager.js里的操作都会对应到UIManagerModule里来。

## 关键点3：UIManagerModule.createView

在UIManagerModule这个类里被@ReactMethod注解标记的都是可以被js调用的方法。UIManagerModule把功能委托给了UIImplementation来实现。


```java
public class UIImplementation {

  /**
   * Invoked by React to create a new node with a given tag, class name and properties.
   */
  public void createView(int tag, String className, int rootViewTag, ReadableMap props) {
    ReactShadowNode cssNode = createShadowNode(className);
    ReactShadowNode rootNode = mShadowNodeRegistry.getNode(rootViewTag);
    cssNode.setReactTag(tag);
    cssNode.setViewClassName(className);
    cssNode.setRootNode(rootNode);
    cssNode.setThemedContext(rootNode.getThemedContext());

    mShadowNodeRegistry.addNode(cssNode);

    ReactStylesDiffMap styles = null;
    if (props != null) {
      styles = new ReactStylesDiffMap(props);
      cssNode.updateProperties(styles);
    }

    handleCreateView(cssNode, rootViewTag, styles);
  }
  
    protected void handleCreateView(
        ReactShadowNode cssNode,
        int rootViewTag,
        @Nullable ReactStylesDiffMap styles) {
      if (!cssNode.isVirtual()) {
        mNativeViewHierarchyOptimizer.handleCreateView(cssNode, cssNode.getThemedContext(), styles);
      }
    }
}
```

ReactShadowNode用来描述DOM树的节点，它将js层传递过来的UI信息包装成一个ReactShadowNode，调用handleCreateView()方法把UI的操作封装成一个
Action，放进队列中等到执行。

## 关键点4：NativeViewHierarchyManager.createView()

从上面的序列可以看出，所有的View操作都会被被包装成一个Action，然后放在队列中等待处理。

```java
public class NativeViewHierarchyManager {

    public void createView(
          ThemedReactContext themedContext,
          int tag,
          String className,
          @Nullable ReactStylesDiffMap initialProps) {
        UiThreadUtil.assertOnUiThread();
        SystraceMessage.beginSection(
            Systrace.TRACE_TAG_REACT_VIEW,
            "NativeViewHierarchyManager_createView")
            .arg("tag", tag)
            .arg("className", className)
            .flush();
        try {
          ViewManager viewManager = mViewManagers.get(className);
    
          View view = viewManager.createView(themedContext, mJSResponderHandler);
          mTagsToViews.put(tag, view);
          mTagsToViewManagers.put(tag, viewManager);
    
          // Use android View id field to store React tag. This is possible since we don't inflate
          // React views from layout xmls. Thus it is easier to just reuse that field instead of
          // creating another (potentially much more expensive) mapping from view to React tag
          view.setId(tag);
          if (initialProps != null) {
            viewManager.updateProperties(view, initialProps);
          }
        } finally {
          Systrace.endSection(Systrace.TRACE_TAG_REACT_VIEW);
        }
      }
}
```

可以看到该函数调用ViewManager.createView()来创建了View。

```java
@ReactPropertyHolder
public abstract class ViewManager<T extends View, C extends ReactShadowNode>
  extends BaseJavaModule {

     public final T createView(
         ThemedReactContext reactContext,
         JSResponderHandler jsResponderHandler) {
       T view = createViewInstance(reactContext);
       addEventEmitters(reactContext, view);
       if (view instanceof ReactInterceptingViewGroup) {
         ((ReactInterceptingViewGroup) view).setOnInterceptTouchEventListener(jsResponderHandler);
       }
       return view;
     }
}
```
ViewManager.createView()方法调用相应组件的构造函数构建View实例，并设置事件发射器，当前View发生的事件会通过发射器发送到JS层处理。


以上便是React Native渲染的整个流程，我们再来总结一下。

1. React Native将代码由JSX转化为JS组件，启动过程中利用instantiateReactComponent将ReactElement转化为复合组件ReactCompositeComponent与元组件ReactNativeBaseComponent，利用
ReactReconciler对他们进行渲染。
2. UIManager.js利用C++层的Instance.cpp将UI信息传递给UIManagerModule.java，并利用UIManagerModule.java构建UI。
3. UIManagerModule.java接收到UI信息后，将UI的操作封装成对应的Action，放在队列中等待执行。各种UI的操作，例如创建、销毁、更新等便在队列里完成，UI最终
得以渲染在屏幕上。

