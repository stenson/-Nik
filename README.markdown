-NIK...
=======
Is a javascript wrapper for the wordnik api, built w/ jQuery
-------------------------------------------
really just kind of a syntax-niceifier.
---------------------------------------
very much not really ready for use, initial stages
---------------------------------------

to use:

include a jquery (recent),
then do it when-ya need it.

      $(function(){
         Nik.bootWith(<YOUR_WORDNIK_APIKEY_HERE>);
         
         // functional style
         Nik.Word.definitions("channel cat",{
            sourceDictionary: "wordnet"
            callback: function(data) {
               console.log(data);
            }
         });
         // or (there is a default console.log callback)
         Nik.Word.examples("banshee");
         
         // OO-style
         var word = new Nik.Word("painlore");
         word.definitions({
            callback: function(definitions) {
               console.log(data);
            }
         });
         
         // same goes for all the standard wordnik methods (for now!)
      });