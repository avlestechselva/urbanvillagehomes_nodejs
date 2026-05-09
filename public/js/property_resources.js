$(document).on("click", ".resource-class", function () {
    var resource_path = $(this).data('path');
    console.log(resource_path);
    $("#resourcesModal #resources-modal-object").attr( "data", resource_path );

    $('#resourcesModal').modal('show');
});
