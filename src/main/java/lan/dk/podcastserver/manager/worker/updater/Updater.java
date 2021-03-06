package lan.dk.podcastserver.manager.worker.updater;

import lan.dk.podcastserver.entity.Item;
import lan.dk.podcastserver.entity.Podcast;
import lan.dk.podcastserver.utils.facade.UpdateTuple;

import java.util.Set;
import java.util.function.Predicate;


public interface Updater {

    UpdateTuple<Podcast, Set<Item>, Predicate<Item>> NO_MODIFICATION_TUPLE = UpdateTuple.of(null, null, null);

    UpdateTuple<Podcast, Set<Item>, Predicate<Item>> update(Podcast podcast);

    Set<Item> getItems(Podcast podcast);

    String signatureOf(Podcast podcast);

    default Predicate<Item> notIn(Podcast podcast) {
        return item -> !podcast.contains(item);
    }

    AbstractUpdater.Type type();
}
