function PandaUploader(){}

PandaUploader.supportAjaxUpload = function() {
    var fi = document.createElement('INPUT');
    fi.type = 'file';
    return 'files' in fi;
};

PandaUploader.supportAjaxProgressEvents = function() {
    if (typeof XDomainRequest != 'undefined') {
        return true;
    }
    else if (typeof XMLHttpRequest != 'undefined') {
        var ret = new XMLHttpRequest()
        return 'withCredentials' in ret;
    }
    else {
        return null;
    }
};

PandaUploader.createXRequestObject = function() {
    if (typeof XDomainRequest != 'undefined') {
        return new XDomainRequest();
    }
    else if (typeof XMLHttpRequest != 'undefined') {
        var ret = new XMLHttpRequest()
        return 'withCredentials' in ret ? ret : null;
    }
    else {
        return null;
    }
};

PandaUploader.bind = function(object, method_name) {
    return function() {
        return object[method_name].apply(object, arguments);
    }
}


PandaUploader.alert = function(msg) {
    return alert(msg);
};

PandaUploader.FlashWidget = function(query, signed_params, options, swfupload_options) {
    swfupload_options = swfupload_options === undefined ? {} : swfupload_options;
    this.swfupload = query.swfupload(jQuery.extend({
        upload_url: options.api_url + '/videos.json',
        file_size_limit : 0,
        file_types : "*.*",
        file_types_description : "All Files",
        file_upload_limit : 0,
        flash_url : options.uploader_dir + "/swfupload.swf",
        button_image_url : options.uploader_dir + "/choose_file_button.png",
        button_width : 87,
        button_height : 27,
        button_placeholder_id : options.upload_button_id,
        file_post_name: "file",
        debug: false
    }, swfupload_options));
    
    var swfupload = this.swfupload;
    this.swfupload.bind('fileQueued', function() {
        swfupload.data('__swfu').setPostParams(signed_params.call ? signed_params() : signed_params)
    })
};
PandaUploader.FlashWidget.prototype = {
    setUploadStrategy: function(upload_strategy) {
        this.swfupload.bind('swfuploadLoaded', PandaUploader.bind(upload_strategy, 'onLoad'));
        this.swfupload.bind('fileQueued', PandaUploader.bind(upload_strategy, 'onFileQueued'));
        this.swfupload.bind('uploadStart', PandaUploader.bind(upload_strategy, 'onStart'));
        this.swfupload.bind('uploadProgress', PandaUploader.bind(upload_strategy, 'onProgress'));
        this.swfupload.bind('uploadSuccess', PandaUploader.bind(upload_strategy, 'onSuccess'));
        this.swfupload.bind('uploadError', PandaUploader.bind(upload_strategy, 'onError'));
        this.swfupload.bind('uploadComplete', PandaUploader.bind(upload_strategy, 'onComplete'));
    },
    
    getForm: function() {
        return this.swfupload.parents('form').eq(0);
    },
    
    start: function() {
        return this.swfupload.swfupload('startUpload');
    },
    
    disable: function() {
        return this.swfupload.swfupload('setButtonDisabled', true);
    },
    
    enable: function() {
        return this.swfupload.swfupload('setButtonDisabled', false);
    },
    
    cancel: function() {
        return this.swfupload.swfupload('cancelUpload', '', false);
    },
    
    setValue: function(value) {
        return this.swfupload.val(value);
    },
    
    getValue: function() {
        return this.swfupload.val();
    }
    
};


(function(){

UPLOADING=0
STOP=1

jQuery.fn.checkPandaUploaderOptions = function(signed_params, options) {
    var form = this.parents("form")[0];
    
    if (signed_params === undefined) {
        PandaUploader.alert("There was an error setting up the upload form. (The upload parameters were not specified).");
        return false;
    }
    
    if (options.upload_button_id === undefined) {
        PandaUploader.alert("You have to specify the button id");
        return false;
    }
    
    if (this.size() == 0) {
        PandaUploader.alert("The jQuery element is empty. Method pandaUploader() cannot be executed");
        return false;
    }
    
    if ( ! form) {
        PandaUploader.alert("Could not find a suitable form. Please place the call to pandaUploader() after the form, or to be executed onload().");
        return false;
    }
    
    if ($(form).find('[name=submit], #submit').length != 0) {
        PandaUploader.alert("An element of your video upload form is incorrect (most probably the submit button). Neither NAME nor ID can be set to \"submit\" on any field.");
        return false;
    }
    
    return true;
}

jQuery.fn.pandaUploader = function(signed_params, options, swfupload_options) {
    options = options === undefined ? {} : options;
    if ( ! this.checkPandaUploaderOptions(signed_params, options)) {
        return false;
    }
    
    options = jQuery.extend({
        upload_filename_id: null,
        upload_progress_id: null,
        api_host: 'api.pandastream.com',
        progress_handler: null,
        uploader_dir: "/panda_uploader",
        disable_submit_button: true,
        strategy: 'upload_on_submit'
    }, options);
    options['api_url'] = options['api_url'] || 'http://' + options['api_host'] + '/v2';
    
    if ( ! options.progress_handler) {
        options.progress_handler = new ProgressUpload(options);
    }
    
    var widget = new PandaUploader.FlashWidget(this, signed_params, options, swfupload_options);
    
    var strategyClass = null;
    switch(options.strategy) {
    case 'upload_on_submit':
        strategyClass = UploadOnSubmit;
        break;
    case 'upload_on_select':
        strategyClass = UploadOnSelect;
        break;
    default:
        strategyClass = options.strategy;
    }
    strategy = new strategyClass(this.parents("form")[0], options);
    strategy.setUploadWidget(widget)
    widget.setUploadStrategy(strategy);
    
    var $cancel_button = jQuery('#' + options.upload_cancel_button_id);
    if ($cancel_button) {
        $cancel_button.click(PandaUploader.bind(strategy, 'onCancel'));
    }
    
    return this;
}


//
// BaseStrategy
//

function BaseStrategy(form, options) {
    this.form = form;
    this.options = options;
}
BaseStrategy.prototype = {
    setUploadWidget: function (upload_widget) {
        this.widget = upload_widget;
    },
    disableSubmitButton: function(value){
        $(this.form).find("input[type=submit]").attr("disabled", value);
    },

    onLoad: function() {
        var form = this.widget.getForm();
        form.submit(PandaUploader.bind(this, 'onSubmit'));
        if(this.options.disable_submit_button) {
            this.disableSubmitButton(true);
        }
    },
    
    onSubmit: function() {
    },
    onFileQueued: function() {
    },
    onStart: function() {
    },
    onProgress: function() {
    },
    onSuccess: function() {
    },
    onError: function() {
    },
    onComplete: function() {
    },
    
    triggerEvent: function(event, args, alternative) {
        var handler = this.options[event];
        if (handler) {
            handler.apply(this, args);
        } else if (alternative) {
            alternative();
        }
    }
}


//
// UploadOnSubmit
//

function UploadOnSubmit(form, options) {
    BaseStrategy.apply(this, [form, options]);
    this.num_files = 0;
    this.num_pending = 0;
    this.num_errors = 0
    this.status = STOP
}
UploadOnSubmit.prototype = new BaseStrategy();
UploadOnSubmit.prototype.constructor = UploadOnSubmit;

UploadOnSubmit.prototype.onFileQueued = function(event, file) {
    this.num_files++;
    this.num_pending++;
    var $field = $('#' + this.options.upload_filename_id);
    if ($field.size() == 0) {
        return;
    }
    $field.val(file.name);
    this.disableSubmitButton(false)
}

UploadOnSubmit.prototype.onSubmit = function(event) {
    if (this.num_files > 0) {
        this.widget.start();
        return false;
    }
}

UploadOnSubmit.prototype.onStart = function(event, file) {
    this.status = UPLOADING;
    this.widget.disable();
    this.options.progress_handler.reset();

    this.disableSubmitButton(true);
    if (this.options.progress_handler) {
        this.options.progress_handler.start(file);
    }
    this.triggerEvent('start', [event, file]);
}

UploadOnSubmit.prototype.onCancel = function(event) {
    this.widget.cancel();
    this.widget.enable();

    $('#' + this.options.upload_filename_id).val('');
    this.options.progress_handler.reset();
    this.num_files = 0;
    this.num_pending = 0;
    this.num_errors = 0;
    if (this.options.disableSubmitButton) {
        this.disableSubmitButton(true);
    }
    
    if(this.widget.status == UPLOADING) {
        this.triggerEvent('cancel', [event]);
    }
    this.status = STOP;
}

UploadOnSubmit.prototype.onProgress = function(event, file, bytesLoaded, bytesTotal) {
    try {
        if (this.options.progress_handler) {
            this.options.progress_handler.setProgress(file, bytesLoaded, bytesTotal);
        }
    } catch (ex) {
    }
}

UploadOnSubmit.prototype.onSuccess = function(event, file, response) {
    this.widget.setValue(eval('(' + response + ')').id);
    this.num_pending--;
    this.triggerEvent('success', [event, file, response]);
}

UploadOnSubmit.prototype.onError = function(event, file, code, message, more) {
    $('#' + this.options.upload_filename_id).val('');
    this.options.progress_handler.reset();

    this.num_pending--;
    this.num_errors++;

    this.triggerEvent('error', [event, file, message], function() {
        alert("There was an error uploading the file.\n\nHTTP error code " + message);
    });
}

UploadOnSubmit.prototype.onComplete = function(event, num_uploads) {
    if (this.num_files > 0 && this.num_pending <= 0 && this.num_errors <= 0) {
        if ( ! this.widget.getValue()) {
            alert('The video ID was not stored on the form');
            return;
        }

        this.status = STOP;
        var that = this;
        this.triggerEvent('complete', [event], function() {
            that.form.submit();
        });
    }
}


//
// UploadOnSelect
//

function UploadOnSelect(form, options) {
    BaseStrategy.apply(this, [form, options]);
}
UploadOnSelect.prototype = new BaseStrategy();
UploadOnSelect.prototype.constructor = UploadOnSelect;

UploadOnSelect.prototype.onFileQueued = function(event, file) {
    this.widget.start();
}

UploadOnSelect.prototype.onStart = function(event, file) {
    this.options.progress_handler.reset();

    this.disableSubmitButton(true);
    if (this.options.progress_handler) {
        this.options.progress_handler.start(file);
    }
    this.triggerEvent('start', [event, file]);
}

UploadOnSelect.prototype.onCancel = function(event) {
    this.cancel();
    this.enable();

    $('#' + this.options.upload_filename_id).val('');
    this.options.progress_handler.reset();
    if (this.options.disableSubmitButton) {
        this.disableSubmitButton(true);
    }

    if(this.widget.status == UPLOADING) {
        this.triggerEvent('cancel', [event]);
    }
}

UploadOnSelect.prototype.onProgress = function(event, file, bytesLoaded, bytesTotal) {
    try {
        if (this.options.progress_handler) {
            this.options.progress_handler.setProgress(file, bytesLoaded, bytesTotal);
        }
    } catch (ex) {
    }
}

UploadOnSelect.prototype.onSuccess = function(event, file, response) {
    this.widget.setValue(eval('(' + response + ')').id);
    this.num_pending--;

    this.triggerEvent('success', [event, file, response]);
}

UploadOnSelect.prototype.onError = function(event, file, code, message, more) {
    $('#' + this.options.upload_filename_id).val('');
    this.options.progress_handler.reset();

    this.num_pending--;
    this.num_errors++;

    this.triggerEvent('error', [event, file, message], function() {
        alert("There was an error uploading the file.\n\nHTTP error code " + message);
    });
}

UploadOnSelect.prototype.onComplete = function(event, num_uploads) {
    if ( ! this.widget.getValue()) {
        alert('The video ID was not stored on the form');
        return;
    }
    this.disableSubmitButton(false);

    this.status = STOP;
    this.triggerEvent('complete', [event]);
}


//
// A simple progress bar
//

function ProgressUpload(options) {
    this.options = options;
    this.$p = jQuery('#' + this.options.upload_progress_id);
    this.$p.css('display', 'none');
    this.count = 0;
}

ProgressUpload.prototype = {
    start: function(file) {
        this.count = 0
        if (this.$p.size() == 0) {
            return;
        }
        
        if (this.$p.find('.progress-inside').size() == 0) {
            this.$p.append('<div class="progress-inside"></div>');
        }
        
        this.progress = this.$p.find('.progress-inside');
        this.setProgress(file, 0, file.size);
        this.$p.css('display', 'block');
        var self = this;
        this.timer = setInterval(function(){self.animateBarBg()}, 20);
    },
    
    setProgress: function(file, bytesLoaded, bytesTotal) {
        if ( ! this.progress) {
            return;
        }
        var percent = Math.ceil((bytesLoaded / bytesTotal) * 100);
        $(this.progress).css('width', percent + '%');
    },
    
    animateBarBg: function() {
        this.count++;
        var bpos = this.$p.css("background-position");
        var currentOffset = bpos ? bpos.split(' ') : 0;
        if (this.count == 37) {
            this.count = 0;
            this.$p.css("background-position", (currentOffset + 36) + "px 0px");
        }
        else {
            this.$p.css("background-position", (currentOffset - 1) + "px 0px");
        }
    },
    
    reset: function(){
        clearInterval(this.timer)
        $(this.progress).css('width', '0%');
        this.$p.css('display', 'none');
    }
}


})();