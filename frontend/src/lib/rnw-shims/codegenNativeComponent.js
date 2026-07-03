// No-op shim for React Native's Fabric codegen helper on web.
// Native components declared via codegenNativeComponent are never rendered on
// web (react-native-web provides its own implementations), so a stub is enough.
export default function codegenNativeComponent() {
  return function NativeComponentStub() {
    return null;
  };
}
