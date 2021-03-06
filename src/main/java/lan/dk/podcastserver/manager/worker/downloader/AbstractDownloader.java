package lan.dk.podcastserver.manager.worker.downloader;

import lan.dk.podcastserver.business.ItemBusiness;
import lan.dk.podcastserver.business.PodcastBusiness;
import lan.dk.podcastserver.entity.Item;
import lan.dk.podcastserver.entity.Status;
import lan.dk.podcastserver.manager.ItemDownloadManager;
import lan.dk.podcastserver.service.PodcastServerParameters;
import lan.dk.podcastserver.utils.MimeTypeUtils;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.FilenameUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import javax.annotation.Resource;
import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.concurrent.atomic.AtomicBoolean;

public abstract class AbstractDownloader implements Runnable, Downloader {

    protected final Logger logger = LoggerFactory.getLogger(this.getClass());

    public static final String WS_TOPIC_DOWNLOAD = "/topic/download";
    public static final String WS_TOPIC_PODCAST = "/topic/podcast/";

    protected Item item;
    protected String temporaryExtension;
    protected File target = null;

    @Resource protected ItemDownloadManager itemDownloadManager;
    @Resource protected PodcastBusiness podcastBusiness;
    @Resource protected ItemBusiness itemService;
    @Resource protected PodcastServerParameters podcastServerParameters;
    @Resource protected SimpMessagingTemplate template;

    protected AtomicBoolean stopDownloading = new AtomicBoolean(false);

    public Item getItem() {
        return item;
    }
    public Downloader setItem(Item item) {
        this.item = item;
        return this;
    }

    @Override
    public void run() {
        logger.debug("Run");
        this.startDownload();
    }

    @Override
    public void startDownload() {
        this.item.setStatus(Status.STARTED);
        stopDownloading.set(false);
        this.saveSyncWithPodcast();
        this.convertAndSaveBroadcast();
        this.download();
    }

    @Override
    public void pauseDownload() {
        this.item.setStatus(Status.PAUSED);
        stopDownloading.set(true);
        this.saveSyncWithPodcast();
        this.convertAndSaveBroadcast();
    }

    @Override
    public void stopDownload() {
        this.item.setStatus(Status.STOPPED);
        stopDownloading.set(true);
        this.saveSyncWithPodcast();
        itemDownloadManager.removeACurrentDownload(item);
        if (target != null && target.exists())
            target.delete();
        this.convertAndSaveBroadcast();
    }

    @Override
    @Transactional
    public void finishDownload() {
        itemDownloadManager.removeACurrentDownload(item);
        if (target != null) {
            this.item.setStatus(Status.FINISH);
            try {

                if (target.getAbsolutePath().contains(temporaryExtension)) { // Si contient l'extention temporaire.
                    File targetWithoutExtension = new File(target.getAbsolutePath().replace(temporaryExtension, ""));
                    if (targetWithoutExtension.exists())
                        targetWithoutExtension.delete();
                    FileUtils.moveFile(target, targetWithoutExtension);
                    target = targetWithoutExtension;
                }
            } catch (IOException e) {
                e.printStackTrace();
                logger.error("IOException :", e);
            }

            this.item.setFileName(FilenameUtils.getName(target.getAbsolutePath()));
            this.item.setDownloadDate(ZonedDateTime.of(LocalDateTime.now(), ZoneId.systemDefault()));
            this.item.setLength(FileUtils.sizeOf(target));

            try {
                this.item.setMimeType(MimeTypeUtils.probeContentType(target.toPath()));
            } catch (IOException e) {
                e.printStackTrace();
                this.item.setMimeType(MimeTypeUtils.getMimeType(FilenameUtils.getExtension(target.getAbsolutePath())));
            }

            this.saveSyncWithPodcast();
            this.convertAndSaveBroadcast();
        } else {
            resetDownload();
        }


    }

    public void resetDownload() {
        this.stopDownload();
    }

    @Transactional
    public File getTagetFile (Item item) {

        if (target != null)
            return target;

        File finalFile = getTempFile(item);
        logger.debug("Création du fichier : {}", finalFile.getAbsolutePath());
        //logger.debug(file.getAbsolutePath());

        if (!finalFile.getParentFile().exists()) {
            finalFile.getParentFile().mkdirs();
        }

        if (finalFile.exists() || new File(finalFile.getAbsolutePath().concat(temporaryExtension)).exists()) {
            logger.info("Doublon sur le fichier en lien avec {} - {}, {}", item.getPodcast().getTitle(), item.getId(), item.getTitle() );
            try {
                finalFile  = File.createTempFile(
                        FilenameUtils.getBaseName(getItemUrl()).concat("-"),
                        ".".concat(FilenameUtils.getExtension(getItemUrl())),
                        finalFile.getParentFile());
                finalFile.delete();
            } catch (IOException e) {
                logger.error("Erreur lors du renommage d'un doublon", e);
            }
        }

        return new File(finalFile.getAbsolutePath() + temporaryExtension) ;
    }

    private File getTempFile(Item item) {
        String fileName = FilenameUtils.getName(String.valueOf(getItemUrl()));

        if (fileName != null && fileName.lastIndexOf("?") != -1)
            fileName = fileName.substring(0, fileName.lastIndexOf("?"));

        return new File(itemDownloadManager.getRootfolder() + File.separator + item.getPodcast().getTitle() + File.separator + fileName);
    }

    @Transactional
    protected Item saveSyncWithPodcast() {
        try {
            this.item.setPodcast(podcastBusiness.findOne(this.item.getPodcast().getId()));
            return itemService.save(this.item);
        } catch (Exception e) {
            logger.error("Error during save and Sync of the item {}", this.item, e);
            return new Item();
        }
    }

    @Transactional
    protected void convertAndSaveBroadcast() {
        this.template.convertAndSend(WS_TOPIC_DOWNLOAD, this.item );
        this.template.convertAndSend(WS_TOPIC_PODCAST.concat(String.valueOf(item.getPodcast().getId())), this.item );
    }

    public String getItemUrl() {
        return item.getUrl();
    }
    
    @PostConstruct
    public void postConstruct() {
        this.temporaryExtension = podcastServerParameters.getDownloadExtention();
    }
}
