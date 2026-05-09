var slideIndex = 1;
showSlides(slideIndex);

function plusSlides(n) {
    showSlides(slideIndex += n);
}

function currentSlide(n) {
    showSlides(slideIndex = n);
}

function showSlides(n) {
    var i;
    var slides = document.getElementsByClassName("mySlides");
    var dots = document.getElementsByClassName("dot");
    if (n > slides.length) {slideIndex = 1}
    if (n < 1) {slideIndex = slides.length}
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    for (i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" activee", "");
    }
    slides[slideIndex-1].style.display = "block";
    dots[slideIndex-1].className += " activee";
}


var slideIndex_2 = 1;
showSlides_2(slideIndex_2);
function plusSlides_2(n) {
    showSlides_2(slideIndex_2 += n);
}

function currentSlide_2(n) {
    showSlides_2(slideIndex_2 = n);
}

function showSlides_2(n) {
    var i;
    var slides = document.getElementsByClassName("mySlides_2");
    var dots = document.getElementsByClassName("dot_2");
    if (n > slides.length) {slideIndex_2 = 1}
    if (n < 1) {slideIndex_2 = slides.length}
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    for (i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" activeee", "");
    }
    slides[slideIndex_2-1].style.display = "block";
    dots[slideIndex_2-1].className += " activeee";
}
