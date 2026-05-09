$('#span-group').on('click', function(){
    var residence_for="";
    residence_for = $('#span-group').find('span:hidden').text();
    $('#residence').val(residence_for);

});
