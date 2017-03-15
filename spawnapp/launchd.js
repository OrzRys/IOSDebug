'use strict';
Memory = global.Memory;
Process = global.Process;
rpc = global.rpc;

var readU16 = Memory.readU16;
var writeU16 = Memory.writeU16;
var readU32 = Memory.readU32;
var readPointer = Memory.readPointer;
var readString = Memory.readUtf8String;
var pointerSize = Process.pointerSize;
var POSIX_SPAWN_START_SUSPENDED = 0x0080;

var specidentifier = null;

rpc.exports = {
  prepareForLaunch: function (identifier) {
    specidentifier = identifier;
  },
  cancelLaunch: function (identifier) {
    specidentifier = null;
  }
};

//  /usr/lib/system/libsystem_kernel.dylib
var posix_spawn_ptr = Module.findExportByName(null, '__posix_spawn')
var posix_spawn = new NativeFunction(posix_spawn_ptr, 'int', ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'pointer'])
Interceptor.replace(posix_spawn_ptr, new NativeCallback(function(pid_np, path_np, actions_np, attrp_np, argv_np, envp_np){
    var match = false;
    if(specidentifier != null){
        if(readString(path_np) == '/usr/libexec/xpcproxy'){
            var identifier;
            var rawIdentifier = readString(readPointer(attrp_np.add(pointerSize)));
            if (rawIdentifier.indexOf('UIKitApplication:') === 0) {
                identifier = rawIdentifier.substring(17, rawIdentifier.lastIndexOf('['));
                if(identifier === specidentifier){
                    match = true;
                }
            }
            else if(rawIdentifier === specidentifier){
                match = true;
            }
        }
    }
    if(match){//do we need this?
        var flags = readU16(attrp_np);
        flags |= POSIX_SPAWN_START_SUSPENDED;
        writeU16(attrs, flags);
    }
    var ret = posix_spawn(pid_np, path_np, actions_np, attrp_np, argv_np, envp_np);
    if(match && ret >= 0){
        send([event, identifier, readU32(pid_np)]);
        identifier = null;
    }
    return ret;
}, 'int', ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'pointer']))

